// 세션 토큰 검증 + 사용자 데이터 반환 (기기 변경 보존 로드). Vercel 서버리스 함수(co-locate).
//   URL: https://<plnl-vercel-도메인>/api/aits/auth/me  (메서드 GET, Authorization: Bearer)
//   원본: docs/backend/api-aits-auth-me.ts (Next.js route.ts) → @vercel/node 핸들러로 이식.
//
// 클라이언트 src/lib/userData.ts:loadRemoteState 가 이 라우트를 호출.
// 응답 { user } 는 PlnlRow | null — null 이면 신규 유저(클라가 빈 상태로 시작 후 저장 시 생성).
//
// CORS: 미니앱(`*.apps.tossmini.com`)에서 호출 → AITS_ALLOWED_ORIGINS 화이트리스트(http.preflight).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, verifySession } from "../../../lib/aits/session";
import { fetchRow } from "../../../lib/aits/db";
import { preflight } from "../../../lib/aits/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (preflight(req, res, "GET")) return;

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  const payload = await verifySession(token);
  if (!payload) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }
  const userKey = payload.sub;

  // TODO(rate-limit): 원본(docs/backend)은 Upstash 기반 userKey rate limit(authMe: 60 req/60s)을
  //   적용했으나 이 레포엔 @upstash/* 의존성이 없어 no-op. 필요 시 @upstash/ratelimit +
  //   @upstash/redis 추가 후 rateLimitByUserKey(limiters().authMe, userKey) 복원.

  try {
    const row = await fetchRow(userKey);
    res.status(200).json({ userKey, user: row });
  } catch (err) {
    console.error("[aits/auth/me] fetchRow:", err);
    res.status(500).json({ error: "db_error" });
  }
}
