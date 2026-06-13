// 스트릭 마일스톤 보상 — 기획 §6.1. 3·7·14·30일 달성 시 전면형 광고 보고 포인트 수령.
// 자동 지급 ✗ → claim(광고 시청) 필요. 한 번 받은 마일스톤은 중복 지급 안 함(claimed).

import { STREAK_MILESTONES, type StreakMilestone } from "./content";
import type { PlnlState } from "./model";

/** 지금 수령 가능한 마일스톤 (도달했고 아직 안 받은 것 중 가장 낮은 것). 없으면 null. */
export function nextClaimableMilestone(
  streak: number,
  claimed: number[],
): StreakMilestone | null {
  return (
    STREAK_MILESTONES.find((r) => streak >= r.d && !claimed.includes(r.d)) ??
    null
  );
}

export type MilestoneStatus = "got" | "ready" | "locked";

export interface MilestoneChip extends StreakMilestone {
  status: MilestoneStatus;
}

/** 마일스톤 칩 표시용 — 받음/수령가능/잠금. */
export function milestoneChips(
  streak: number,
  claimed: number[],
): MilestoneChip[] {
  return STREAK_MILESTONES.map((r) => {
    const got = claimed.includes(r.d);
    const status: MilestoneStatus = got
      ? "got"
      : streak >= r.d
        ? "ready"
        : "locked";
    return { ...r, status };
  });
}

/**
 * 마일스톤 수령 적용(광고 시청 완료 후 호출). 포인트 적립 + claimed 기록.
 * 이미 받았거나 미도달이면 변화 없이 그대로 반환(멱등 — 중복 지급 방지).
 */
export function applyMilestoneClaim(
  state: PlnlState,
  milestone: StreakMilestone,
): PlnlState {
  if (state.claimed.includes(milestone.d)) return state;
  return {
    ...state,
    points: state.points + milestone.p,
    claimed: [...state.claimed, milestone.d].sort((a, b) => a - b),
  };
}
