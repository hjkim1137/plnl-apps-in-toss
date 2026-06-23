// 설정 변경 — fee ≥ 0 / target ≥ 1 검증. 클라 usePlnl.setSettings 미러.
// 복사 위치: plnl.vercel.app/app/api/aits/user/settings/route.ts
// body: { fee?, target? } → { fee, target }

import { NextRequest } from "next/server";
import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverSettings } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: NextRequest) {
  return handleUserAction(
    req,
    limiters().userSettings,
    (row, b) => serverSettings(row, b.fee, b.target),
    (row) => ({ fee: row.fee, target: row.target }),
  );
}
