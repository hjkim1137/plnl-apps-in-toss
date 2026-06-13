// 대표 칭호(누적 출석 레벨) 판정 — 기획 §6.2. 누적 출석 기준 등급 1개 + 다음까지 진행바.
// 이달 회수율 구간(brackets.ts)과 분리: 구간은 매달 리셋, 칭호는 누적 장기 등급.

import { LEVELS, type Level } from "./content";

export interface TitleProgress {
  /** LEVELS 인덱스. */
  index: number;
  current: Level;
  /** 다음 등급(최고 등급이면 null). */
  next: Level | null;
  /** 현재 등급 내 진행률(0~100). 최고 등급이면 100. */
  progressPct: number;
  /** 다음 등급까지 남은 출석 횟수(최고 등급이면 0). */
  remainingToNext: number;
}

/** 누적 출석 횟수로 대표 칭호 + 진행도 산정. */
export function resolveTitle(totalDone: number): TitleProgress {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalDone >= LEVELS[i].min) index = i;
  }
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  if (!next) {
    return { index, current, next: null, progressPct: 100, remainingToNext: 0 };
  }
  const span = next.min - current.min;
  const progressPct =
    span <= 0
      ? 100
      : Math.min(100, Math.round(((totalDone - current.min) / span) * 100));
  return {
    index,
    current,
    next,
    progressPct,
    remainingToNext: Math.max(0, next.min - totalDone),
  };
}
