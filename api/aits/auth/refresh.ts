// 세션 갱신 — refreshToken 검증 후 새 access(sessionToken) 발급. Vercel 서버리스 함수(co-locate).
//   URL: https://<plnl-vercel-도메인>/api/aits/auth/refresh  (메서드 POST)
//   원본: docs/backend/api-aits-auth-refresh.ts (Next.js route.ts) → @vercel/node 핸들러로 이식.
//
// 흐름:
//   클라이언트가 access 만료(401) 를 받으면 이 라우트로 refresh 를 보낸다.
//   서버는 refresh 를 검증해 새 access 를 발급. refresh 자체는 회전 안 함(14d 만료까지 재사용).
//   refresh 도 만료/위조면 401 — 클라이언트는 세션 클리어 후 토스 로그인 재진행.
//
// CORS: 미니앱(`*.apps.tossmini.com`)에서 호출 → AITS_ALLOWED_ORIGINS 화이트리스트(http.preflight).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signSession, verifyRefreshToken } from "../../_lib/aits/session.js";
import { parseBody, preflight } from "../../_lib/aits/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, "POST")) return;

  // TODO(rate-limit): 원본(docs/backend)은 Upstash 기반 IP rate limit(authLogin 정책 재사용,
  //   10 req/60s)을 적용했으나 이 레포엔 @upstash/* 의존성이 없어 no-op. 필요 시
  //   @upstash/ratelimit + @upstash/redis 추가 후 rateLimitByIp(limiters().authLogin, req) 복원.

  const body = parseBody(req) as { refreshToken?: unknown };
  if (typeof body.refreshToken !== "string" || body.refreshToken.length === 0) {
    res.status(400).json({ error: "missing_refresh_token" });
    return;
  }

  const payload = await verifyRefreshToken(body.refreshToken);
  if (!payload) {
    res.status(401).json({ error: "invalid_refresh_token" });
    return;
  }

  const sessionToken = await signSession(payload.sub);
  res.status(200).json({ sessionToken });
}
