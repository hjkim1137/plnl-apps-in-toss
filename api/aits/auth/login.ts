// 토스 로그인 — 인가 코드 → 세션 토큰 발급. Vercel 서버리스 함수(plnl-apps-in-toss 레포에 co-locate).
//   URL: https://<plnl-vercel-도메인>/api/aits/auth/login  (메서드 POST)
//   원본: docs/backend/api-aits-auth-login.ts (Next.js route.ts) → @vercel/node 핸들러로 이식.
//
// 정책: sessionToken/refreshToken 발급만 수행. Supabase row 자동 생성은 하지 않는다.
// row 는 클라이언트가 로그인 직후 mergeForLogin → saveRemoteState(upsert) 할 때 처음 생성된다.
// sessionToken 은 stateless JWT 라 row 없어도 정상 발급/검증 가능.
//
// 동의 항목: 토스 로그인은 '이름'만 받는다(생년월일·이메일·성별 등 미수집) → profile { name } 만 반환.
//
// mTLS 호출 위해 Node runtime 필수 (@vercel/node 함수는 기본 Node runtime).
// CORS: 미니앱(`*.apps.tossmini.com`)에서 호출 → AITS_ALLOWED_ORIGINS 화이트리스트(http.preflight).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tossGenerateToken, tossLoginMe } from "../../../lib/aits/tossApi";
import { decryptPIINullable } from "../../../lib/aits/pii";
import { signRefreshToken, signSession } from "../../../lib/aits/session";
import { parseBody, preflight } from "../../../lib/aits/http";

interface LoginRequestBody {
  authorizationCode?: string;
  referrer?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, "POST")) return;

  // TODO(rate-limit): 원본(docs/backend)은 Upstash 기반 IP rate limit(authLogin: 10 req/60s)을
  //   적용했으나 이 레포엔 @upstash/* 의존성이 없어 no-op. 봇 로그인 폭주 방어가 필요하면
  //   @upstash/ratelimit + @upstash/redis 추가 후 rateLimitByIp(limiters().authLogin, req) 복원.

  const body = parseBody(req) as LoginRequestBody;
  const { authorizationCode, referrer } = body;
  if (!authorizationCode || !referrer) {
    res.status(400).json({ error: "missing_fields" });
    return;
  }

  try {
    // 1) 토스 OAuth: 인가 코드 → 액세스 토큰
    const tokenRes = await tossGenerateToken(authorizationCode, referrer);
    if (tokenRes.resultType !== "SUCCESS") {
      res.status(401).json({ error: "token_exchange_failed", detail: tokenRes.error });
      return;
    }
    const { accessToken } = tokenRes.success;

    // 2) 토스 사용자 정보 조회
    const meRes = await tossLoginMe(accessToken);
    if (meRes.resultType !== "SUCCESS") {
      res.status(401).json({ error: "login_me_failed", detail: meRes.error });
      return;
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

    res.status(200).json({
      sessionToken,
      refreshToken,
      userKey: userKeyStr,
      profile: { name },
    });
  } catch (e) {
    console.error("[aits/auth/login] internal:", e);
    res.status(500).json({ error: "internal" });
  }
}
