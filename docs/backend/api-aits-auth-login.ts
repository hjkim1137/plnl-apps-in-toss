// 토스 로그인 — 인가 코드 → 세션 토큰 발급.
// 복사 위치: plnl.vercel.app/app/api/aits/auth/login/route.ts
//
// 정책: sessionToken/refreshToken 발급만 수행. Supabase row 자동 생성은 하지 않는다.
// row 는 클라이언트가 로그인 직후 mergeForLogin → saveRemoteState(upsert) 할 때 처음 생성된다.
// sessionToken 은 stateless JWT 라 row 없어도 정상 발급/검증 가능.

import { NextRequest, NextResponse } from "next/server";
import { tossGenerateToken, tossLoginMe } from "@/lib/aits/tossApi";
import { decryptPIINullable } from "@/lib/aits/pii";
import { limiters, rateLimitByIp, tooManyRequests } from "@/lib/aits/ratelimit";
import { signRefreshToken, signSession } from "@/lib/aits/session";
import { corsHeaders } from "@/lib/aits/db";

// mTLS 호출 위해 Node runtime 필수 (Edge 는 client cert 미지원).
export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

interface LoginRequestBody {
  authorizationCode?: string;
  referrer?: string;
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);

  // 인증 전 라우트 — IP 단위 rate limit. 봇 로그인 폭주 방어.
  const rl = await rateLimitByIp(limiters().authLogin, req);
  if (!rl.ok) return tooManyRequests(rl.retryAfterMs, cors);

  let body: LoginRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: cors });
  }
  const { authorizationCode, referrer } = body;
  if (!authorizationCode || !referrer) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400, headers: cors });
  }

  try {
    // 1) 토스 OAuth: 인가 코드 → 액세스 토큰
    const tokenRes = await tossGenerateToken(authorizationCode, referrer);
    if (tokenRes.resultType !== "SUCCESS") {
      return NextResponse.json(
        { error: "token_exchange_failed", detail: tokenRes.error },
        { status: 401, headers: cors },
      );
    }
    const { accessToken } = tokenRes.success;

    // 2) 토스 사용자 정보 조회
    const meRes = await tossLoginMe(accessToken);
    if (meRes.resultType !== "SUCCESS") {
      return NextResponse.json(
        { error: "login_me_failed", detail: meRes.error },
        { status: 401, headers: cors },
      );
    }
    const { userKey, name: encName } = meRes.success;

    // 3) PII 복호화 — 토스 로그인 동의 항목은 '이름'만 받는다. 생년월일·이메일·성별 등 미수집.
    const name = decryptPIINullable(encName);

    const userKeyStr = String(userKey);

    // 4) 자체 세션 JWT — access 1h + refresh 14d. (row 자동 생성 안 함)
    const [sessionToken, refreshToken] = await Promise.all([
      signSession(userKeyStr),
      signRefreshToken(userKeyStr),
    ]);

    return NextResponse.json(
      { sessionToken, refreshToken, userKey: userKeyStr, profile: { name } },
      { status: 200, headers: cors },
    );
  } catch (e) {
    console.error("[aits/auth/login] internal:", e);
    return NextResponse.json({ error: "internal" }, { status: 500, headers: cors });
  }
}
