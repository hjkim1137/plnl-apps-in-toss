// 보상형 광고(30초) 시청 완료 → +1 보호권(포인트 차감 없음).
// 복사 위치: plnl.vercel.app/app/api/aits/user/claim-freeze-ad/route.ts
// body: { adToken? } → { freezes }
// TODO(광고검증): 가능하면 adToken 을 토스 보상형 광고 완료 검증에 사용(userActions.serverFreezeFromAd 참고).

import { handleUserAction, corsOptions } from "@/lib/aits/route";
import { limiters } from "@/lib/aits/ratelimit";
import { serverFreezeFromAd } from "@/lib/aits/userActions";

export const runtime = "nodejs";
export const OPTIONS = corsOptions;

export async function POST(req: import("next/server").NextRequest) {
  return handleUserAction(
    req,
    limiters().userBuyFreeze, // 보호권 획득 계열 — buy-freeze 와 동일 임계치 공유
    (row) => serverFreezeFromAd(row),
    (row) => ({ freezes: row.freezes }),
  );
}
