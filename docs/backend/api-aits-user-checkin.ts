// 출석 체크 — 서버 권위(+1P 는 서버가 부여). 클라 attendance.applyCheckIn(로그인) 미러.
// 복사 위치: plnl.vercel.app/app/api/aits/user/checkin/route.ts
// body: { date: 'YYYY-MM-DD', value: 'done' | 'missed' } → { logs, points }

import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverCheckin } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: import("next/server").NextRequest) {
  return handleUserAction(
    req,
    limiters().userCheckin,
    (row, b) => serverCheckin(row, b.date, b.value),
    (row) => ({ logs: row.logs, points: row.points }),
  );
}
