// 보호권 포인트 구매 — 서버가 points ≥ 5 검증 후 -5P, +1 보호권.
// 복사 위치: plnl.vercel.app/app/api/aits/user/buy-freeze/route.ts
// body: 없음 → { points, freezes }

import { NextRequest } from "next/server";
import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverBuyFreeze } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: NextRequest) {
  return handleUserAction(
    req,
    limiters().userBuyFreeze,
    (row) => serverBuyFreeze(row),
    (row) => ({ points: row.points, freezes: row.freezes }),
  );
}
