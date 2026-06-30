// 출석 체크 로직 (기획 §4·§5.1). 방문 횟수는 수동 입력이 아니라 출석 체크로 자동 집계.
// 순수 reducer — 화면(A)은 결과(다음 PlnlState)만 받아 렌더한다.

import { POINT_PER_CHECKIN } from "./constants";
import { monthPrefix } from "./date";
import type { Logs, LogValue, PlnlState } from "./model";

/** 특정 달(y, m: 0-based)의 로그만 필터. */
export function monthLogs(logs: Logs, y: number, m: number): Logs {
  const prefix = monthPrefix(y, m);
  const out: Logs = {};
  for (const [k, v] of Object.entries(logs)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  return out;
}

/** 전체 누적 출석('done') 일수 — 회수 통계용(logs 기준). 등급/스트릭은 checkins 사용. */
export function totalDone(logs: Logs): number {
  let n = 0;
  for (const v of Object.values(logs)) if (v === "done") n++;
  return n;
}

/** 월별 출석 수 집계 { 'YYYY-MM': count }. */
export function monthAgg(logs: Logs): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries(logs)) {
    if (v !== "done") continue;
    const ym = k.slice(0, 7);
    m[ym] = (m[ym] ?? 0) + 1;
  }
  return m;
}

/** 본전 졸업(목표 달성) 한 달 수 — 누적 업적. */
export function monthsGraduated(logs: Logs, target: number): number {
  const t = Math.max(1, target);
  return Object.values(monthAgg(logs)).filter((c) => c >= t).length;
}

/**
 * 출석 체크 1회 시도(무제한·무게이트). 다음 PlnlState 를 반환.
 * - 이미 같은 값이면 취소(토글 off), 다른 값이면 교체.
 * - 포인트는 **로그인 유저의 'done(출석)' 진입·이탈에만** ±1P → 하루 한 번.
 *   같은 날을 껐다 켜거나 done↔missed 를 왕복해도 누적되지 않는다(진입 +1P / 이탈 -1P 상쇄).
 *   '안 갔어요'(missed) 는 적립하지 않는다. 비로그인은 적립/게이팅 없이 기록만 토글한다.
 */
export function applyCheckIn(
  state: PlnlState,
  dateStr: string,
  value: LogValue,
): PlnlState {
  const already = state.logs[dateStr];
  const next: PlnlState = { ...state, logs: { ...state.logs } };

  const toggleOff = already === value; // 같은 값 재탭 = 취소
  const willDone = !toggleOff && value === "done";
  const wasDone = already === "done";

  // 포인트는 로그인 유저만. (비로그인은 무제한 기록, 적립/게이팅 없음)
  if (state.loggedIn) {
    if (willDone && !wasDone) next.points = state.points + POINT_PER_CHECKIN;
    else if (wasDone && !willDone) next.points = Math.max(0, state.points - POINT_PER_CHECKIN);
  }

  if (toggleOff) {
    delete next.logs[dateStr]; // 같은 값 다시 누르면 취소
  } else {
    next.logs[dateStr] = value;
  }

  // 오늘 탭 출석만 스트릭에 반영 — 최종 logs 값이 'done' 이면 checkins 포함, 아니면 제외.
  // (달력 cycleDay 는 checkins 를 건드리지 않아 스트릭과 무관.)
  const checkinSet = new Set(state.checkins);
  if (next.logs[dateStr] === "done") checkinSet.add(dateStr);
  else checkinSet.delete(dateStr);
  next.checkins = Array.from(checkinSet).sort();

  return next;
}

/**
 * 달력 날짜 직접 탭 — done ↔ missed 토글(빈 칸은 done 으로). **포인트 없이** 기록만 보정한다
 * (과거 출석 백필 용도). 로그인 유저도 달력 기록엔 +1P 가 안 붙는다(버튼 출석만 +1P).
 */
export function cycleCalendarDay(state: PlnlState, dateStr: string): PlnlState {
  const cur = state.logs[dateStr];
  const nextVal: LogValue = cur === "done" ? "missed" : "done";
  return { ...state, logs: { ...state.logs, [dateStr]: nextVal } };
}

/** 특정 달 출석 기록 전체 초기화 (목업 resetMonth). 해당 달의 checkins(스트릭) 도 함께 제거. */
export function clearMonth(state: PlnlState, y: number, m: number): PlnlState {
  const prefix = monthPrefix(y, m);
  const logs: Logs = {};
  for (const [k, v] of Object.entries(state.logs)) {
    if (!k.startsWith(prefix)) logs[k] = v;
  }
  const checkins = state.checkins.filter((k) => !k.startsWith(prefix));
  // reportSeen/certSeen(광고 본 '달')은 의도적으로 보존 — 초기화해도 이미 본 광고를 다시 보게 하지 않음.
  return { ...state, logs, checkins };
}
