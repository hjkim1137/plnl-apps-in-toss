// 연속 출석 스트릭 (기획 §5.2·§6.1). 로그인 유저 전용 표시.
// 출처: 목업 streakNow / maxStreak / bestStreakAll.

import { dayKey, daysInMonth, parseYmd, ymd } from "./date";
import type { Logs } from "./model";

/**
 * 오늘 기준 연속 출석 일수. 오늘부터 거꾸로 'done' 이 끊길 때까지.
 * ⚠️ 목업 동작: 오늘을 아직 체크 안 했으면 0 으로 보인다(어제까지 N일이어도).
 * = "오늘 출석해야 스트릭이 살아있다"는 푸시 의도. 보호권(freeze) 소비는 미반영(아래 TODO).
 */
export function currentStreak(logs: Logs, now: Date = new Date()): number {
  let s = 0;
  const d = new Date(now);
  while (logs[ymd(d)] === "done") {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

// TODO(보호권): 기획상 보호권은 "빠진 날에도 연속이 끊기지 않게" 막아준다. 소비 시점/규칙
// (자동 vs 수동, 며칠치까지)이 미확정(기획 §10 밸런싱 TODO)이라 v1 currentStreak 은
// 보호권 미반영(목업과 동일). 규칙 확정 후 freeze 차감을 여기에 통합.

/** 특정 달(y, m: 0-based)의 최장 연속 출석. 결산 리포트용. */
export function maxStreakInMonth(logs: Logs, y: number, m: number): number {
  const days = daysInMonth(y, m);
  let mx = 0;
  let cur = 0;
  for (let d = 1; d <= days; d++) {
    const k = dayKey(y, m, d);
    if (logs[k] === "done") {
      cur++;
      mx = Math.max(mx, cur);
    } else {
      cur = 0;
    }
  }
  return mx;
}

/** 전체 기록 통틀어 최장 연속 출석(달 경계 무관). */
export function bestStreakAll(logs: Logs): number {
  const keys = Object.keys(logs)
    .filter((k) => logs[k] === "done")
    .sort();
  let mx = 0;
  let cur = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const d = parseYmd(k);
    if (d == null) continue;
    if (prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1) {
      cur++;
    } else {
      cur = 1;
    }
    mx = Math.max(mx, cur);
    prev = d;
  }
  return mx;
}
