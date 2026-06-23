// 월말 도착 푸시 발송 — Vercel Cron 전용(외부 호출 차단). 기획 §7 · 업무분장 D(F17 서버측).
// 복사 위치: plnl.vercel.app/app/api/aits/push/send/route.ts
//
// 트리거: Vercel Cron (매월 1일 09:00 KST = 00:00 UTC) → 이 라우트.
//   직전 달 회수율로 결산/표창장 "도착" 메시지를 만들어(settlement.buildLastMonthPush)
//   토스 sendMessage(mTLS)로 전 유저 발송. (클라 notify.ts 는 '도착 배너' 표시만, 실제 발송은 여기)
//
// ⚠️ 인증 없으면 403 — 누구나 푸시 트리거 못 하게. 두 경로 허용:
//   1) Vercel Cron — CRON_SECRET env 설정 시 Vercel 이 자동으로 `Authorization: Bearer <CRON_SECRET>` 부착
//   2) 수동 트리거/테스트 — `x-aits-push-secret: <AITS_PUSH_CRON_SECRET>`
// 발송은 SEND_CONCURRENCY 만큼 동시 배치. ⚠️ 규모 더 커지면: fetchAllRows 페이지네이션
// (현재 단일 쿼리, PostgREST 기본 1000행 cap) + 토스 벌크/스마트 발송 API 전환.

import { NextRequest, NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/aits/db";
import { tossSendMessage } from "@/lib/aits/tossApi";
import { buildLastMonthPush, type PushMessage } from "@/lib/aits/settlement";

// 동시 발송 수. tossSendMessage 는 호출마다 새 mTLS 핸드셰이크라 직렬이면 유저 수만큼 누적 →
// Vercel 함수 타임아웃에 걸려 일부만 발송될 위험. 적당한 동시성으로 벽시계 단축(토스 API 과부하 방지).
const SEND_CONCURRENCY = 8;

export const runtime = "nodejs";
// Vercel Cron 은 GET 으로 호출 — POST 도 허용(수동 트리거/테스트). 둘 다 같은 핸들러.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true; // Vercel Cron 자동 헤더
  }
  const manual = process.env.AITS_PUSH_CRON_SECRET;
  return !!manual && req.headers.get("x-aits-push-secret") === manual;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const rows = await fetchAllRows();
    // 발송 대상만 추림(직전 달 활동 없으면 buildLastMonthPush=null → skip).
    const targets: { userKey: string; msg: PushMessage }[] = [];
    for (const row of rows) {
      const msg = buildLastMonthPush(row);
      if (msg) targets.push({ userKey: row.toss_user_key, msg });
    }
    const skipped = rows.length - targets.length;

    // 동시성 제한 배치 — 직렬 await(유저당 mTLS 핸드셰이크) 의 타임아웃 위험 회피.
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i += SEND_CONCURRENCY) {
      const chunk = targets.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((t) => tossSendMessage({ userKey: t.userKey, ...t.msg })),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.resultType === "SUCCESS") sent++;
        else failed++;
      }
    }
    return NextResponse.json({ total: rows.length, sent, skipped, failed });
  } catch (e) {
    console.error("[aits/push/send]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
