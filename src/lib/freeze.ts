// 스트릭 보호권 — 기획 §6. 획득 2경로: 포인트 5P 또는 보상형 광고(30초).
// 빠진 날에도 연속 출석이 끊기지 않게 막아줌 (소비 규칙은 streak.ts TODO 참고).

import { FREEZE_COST_POINTS } from "./constants";
import type { PlnlState } from "./model";

/** 포인트로 보호권을 살 수 있는지. */
export function canBuyFreeze(state: PlnlState): boolean {
  return state.points >= FREEZE_COST_POINTS;
}

/** 포인트 차감 후 보호권 +1. 포인트 부족이면 null. */
export function applyBuyFreeze(state: PlnlState): PlnlState | null {
  if (!canBuyFreeze(state)) return null;
  return {
    ...state,
    points: state.points - FREEZE_COST_POINTS,
    freezes: state.freezes + 1,
  };
}

/** 보상형 광고(30초) 끝까지 시청 후 보호권 +1 (포인트 차감 없음). */
export function applyFreezeFromAd(state: PlnlState): PlnlState {
  return { ...state, freezes: state.freezes + 1 };
}
