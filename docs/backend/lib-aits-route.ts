// 사용자 액션 라우트 공통 래퍼 — 6개 /user/* 라우트의 반복(세션검증·레이트리밋·로드·저장)을 한 곳에.
// 복사 위치: plnl.vercel.app/lib/aits/route.ts
//
// 흐름: Bearer 세션 검증 → userKey rate limit → row 로드(없으면 기본) → run(서버 권위 reducer)
//       → 성공 시 upsert + shape(노출 필드) 응답 / 실패 시 reason → HTTP status 매핑.

import { NextRequest, NextResponse } from "next/server";
import type { Ratelimit } from "@upstash/ratelimit";
import { corsHeaders, fetchRowOrDefault, upsertRow, type PlnlRow } from "@/lib/aits/db";
import { extractBearer, verifySession } from "@/lib/aits/session";
import { rateLimitByUserKey, tooManyRequests } from "@/lib/aits/ratelimit";
import type { ActionResult } from "@/lib/aits/userActions";

// reducer 가 반환하는 reason → HTTP status. 없으면 400.
const REASON_STATUS: Record<string, number> = {
  insufficient_points: 409,
  already_claimed: 409,
  not_reached: 409,
  bad_value: 400,
  bad_date: 400,
  before_min: 400,
  future_date: 400,
  bad_milestone: 400,
  bad_accept: 400,
  no_fields: 400,
};

/** 모든 액션 라우트가 공유하는 OPTIONS(프리플라이트) 응답. `export const OPTIONS = corsOptions`. */
export function corsOptions(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * 액션 라우트 공통 처리.
 * @param run   현재 row + 파싱된 body → ActionResult(서버 권위 계산). 변조 방지의 핵심.
 * @param shape 성공한 row → 응답 바디(라우트마다 노출 필드 다름).
 */
export async function handleUserAction<T>(
  req: NextRequest,
  limiter: Ratelimit,
  run: (row: PlnlRow, body: Record<string, unknown>) => ActionResult | Promise<ActionResult>,
  shape: (row: PlnlRow) => T,
): Promise<NextResponse> {
  const cors = corsHeaders(req);

  const token = extractBearer(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401, headers: cors });
  const payload = await verifySession(token);
  if (!payload) return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: cors });
  const userKey = payload.sub;

  const rl = await rateLimitByUserKey(limiter, userKey);
  if (!rl.ok) return tooManyRequests(rl.retryAfterMs, cors);

  // 빈 바디 허용(buy-freeze / claim-freeze-ad 는 바디 없음).
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* no body */
  }

  try {
    const row = await fetchRowOrDefault(userKey);
    const result = await run(row, body);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason },
        { status: REASON_STATUS[result.reason] ?? 400, headers: cors },
      );
    }
    await upsertRow(result.row);
    return NextResponse.json(shape(result.row), { status: 200, headers: cors });
  } catch (err) {
    console.error("[aits/user] action:", err);
    return NextResponse.json({ error: "db_error" }, { status: 500, headers: cors });
  }
}
