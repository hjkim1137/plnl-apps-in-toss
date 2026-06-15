// 세션 갱신 — refreshToken 검증 후 새 access(sessionToken) 발급.
// 복사 위치: plnl.vercel.app/app/api/aits/auth/refresh/route.ts
//
// 흐름:
//   클라이언트가 access 만료(401) 를 받으면 이 라우트로 refresh 를 보낸다.
//   서버는 refresh 를 검증해 새 access 를 발급. refresh 자체는 회전 안 함(14d 만료까지 재사용).
//   만약 refresh 도 만료/위조면 401 — 클라이언트는 세션 클리어 후 토스 로그인 재진행.
//
// 보안 메모:
//   - access 가 짧기(1h) 때문에 탈취돼도 영향 시간 제한.
//   - refresh 는 14d 라 길지만 type 검증 + 같은 secret 으로만 발급되므로 클라이언트 측 XSS 가
//     발생하지 않는 한 안전. 추가 강화는 refresh rotation 또는 HttpOnly cookie 로 가능 (별도 작업).
//   - rate limit 은 /auth/login 과 같은 IP 기반 정책(authLogin) 재사용.

import { NextRequest, NextResponse } from "next/server";
import {
  limiters,
  rateLimitByIp,
  tooManyRequests,
} from "@/lib/aits/ratelimit";
import { signSession, verifyRefreshToken } from "@/lib/aits/session";
import { corsHeaders } from "@/lib/aits/db";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);

  // IP 기반 rate limit — 로그인과 동일 정책 재사용.
  const rl = await rateLimitByIp(limiters().authLogin, req);
  if (!rl.ok) return tooManyRequests(rl.retryAfterMs, cors);

  let body: { refreshToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: cors },
    );
  }
  if (typeof body.refreshToken !== "string" || body.refreshToken.length === 0) {
    return NextResponse.json(
      { error: "missing_refresh_token" },
      { status: 400, headers: cors },
    );
  }

  const payload = await verifyRefreshToken(body.refreshToken);
  if (!payload) {
    return NextResponse.json(
      { error: "invalid_refresh_token" },
      { status: 401, headers: cors },
    );
  }

  const sessionToken = await signSession(payload.sub);
  return NextResponse.json(
    { sessionToken },
    { status: 200, headers: cors },
  );
}
