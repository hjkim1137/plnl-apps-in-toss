// 보호권 복구 제안 해결(확인 후 복구) — 서버가 메울 날을 직접 계산하므로 클라가 frozen 날짜를
// 임의로 주입할 수 없다(변조 방지). 클라 streak.detect/apply/declineFreezeRepair 미러.
// 복사 위치: plnl.vercel.app/app/api/aits/user/resolve-repair/route.ts
// body: { accept: boolean } → { freezes, frozen, logs }
//   accept=true  → 빈 날을 보호권으로 메움(차감) / accept=false → 'missed' 기록(다시 안 물음)

import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverResolveRepair } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: import("next/server").NextRequest) {
  return handleUserAction(
    req,
    limiters().userResolveRepair,
    (row, b) =>
      typeof b.accept === "boolean"
        ? serverResolveRepair(row, b.accept)
        : { ok: false as const, reason: "bad_accept" },
    (row) => ({ freezes: row.freezes, frozen: row.frozen, logs: row.logs }),
  );
}
