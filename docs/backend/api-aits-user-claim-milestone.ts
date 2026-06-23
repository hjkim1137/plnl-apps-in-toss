// 스트릭 마일스톤 수령 — 서버가 streak 도달·미수령 검증 후 보너스P 부여(중복 지급 차단).
// 복사 위치: plnl.vercel.app/app/api/aits/user/claim-milestone/route.ts
// body: { d: 3|7|14|30 } → { points, claimed }

import { NextRequest } from "next/server";
import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverClaimMilestone } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: NextRequest) {
  return handleUserAction(
    req,
    limiters().userClaimMilestone,
    (row, b) => serverClaimMilestone(row, b.d),
    (row) => ({ points: row.points, claimed: row.claimed_milestones }),
  );
}
