// 세션 토큰 검증 + 사용자 데이터 반환 (기기 변경 보존 로드).
// 복사 위치: plnl.vercel.app/app/api/aits/auth/me/route.ts
//
// 클라이언트 src/lib/userData.ts:loadRemoteState 가 이 라우트를 호출.
// 응답 { user } 는 PlnlRow | null — null 이면 신규 유저(클라가 빈 상태로 시작 후 저장 시 생성).

import { NextRequest, NextResponse } from "next/server";
import { limiters, rateLimitByUserKey, tooManyRequests } from "@/lib/aits/ratelimit";
import { extractBearer, verifySession } from "@/lib/aits/session";
import { corsHeaders, fetchRow } from "@/lib/aits/db";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const token = extractBearer(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401, headers: cors });
  }
  const payload = await verifySession(token);
  if (!payload) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: cors });
  }
  const userKey = payload.sub;

  const rl = await rateLimitByUserKey(limiters().authMe, userKey);
  if (!rl.ok) return tooManyRequests(rl.retryAfterMs, cors);

  try {
    const row = await fetchRow(userKey);
    return NextResponse.json({ userKey, user: row }, { status: 200, headers: cors });
  } catch (err) {
    console.error("[aits/auth/me] fetchRow:", err);
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: cors });
  }
}
