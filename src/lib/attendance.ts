// 출석 체크 로직 (기획 §4·§5.1). 방문 횟수는 수동 입력이 아니라 출석 체크로 자동 집계.
// 순수 reducer — 화면(A)은 결과만 받아 렌더하고, 광고가 필요하면 needAd 로 분기한다.

import { FREE_CHECKIN_LIMIT, POINT_PER_CHECKIN } from "./constants";
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

/** 전체 누적 출석('done') 일수 — 칭호 레벨 산정용. */
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

/** 비로그인 유저의 남은 무료 출석 횟수. */
export function freeCheckinsLeft(state: PlnlState): number {
  return Math.max(0, FREE_CHECKIN_LIMIT - state.freeUsed);
}

export type CheckInResult =
  | { ok: true; next: PlnlState; pointAwarded: boolean }
  | { ok: false; reason: "need_ad" };

/**
 * 출석 체크 1회 시도.
 * - 이미 같은 값이면 취소(토글 off), 다른 값이면 교체 — 이 경우 비용/포인트 미적용.
 * - 새로 기록할 때만: 로그인=+1P / 비로그인=무료차감 → 광고언락소진 → 둘 다 없으면 needAd.
 * 목업 attemptCheckIn 과 동일 정책.
 */
export function applyCheckIn(
  state: PlnlState,
  dateStr: string,
  value: LogValue,
): CheckInResult {
  const already = state.logs[dateStr];
  const next: PlnlState = { ...state, logs: { ...state.logs } };
  let pointAwarded = false;

  if (!already) {
    if (state.loggedIn) {
      next.points = state.points + POINT_PER_CHECKIN;
      pointAwarded = true;
    } else if (state.freeUsed < FREE_CHECKIN_LIMIT) {
      next.freeUsed = state.freeUsed + 1;
    } else if (state.adUnlocked) {
      next.adUnlocked = false; // 광고로 언락해둔 1회 소진
    } else {
      return { ok: false, reason: "need_ad" };
    }
  }

  if (already === value) {
    delete next.logs[dateStr]; // 같은 값 다시 누르면 취소
  } else {
    next.logs[dateStr] = value;
  }
  return { ok: true, next, pointAwarded };
}

/** 비로그인 유저가 출석용 전면형 광고를 끝까지 본 직후 — 1회 출석 언락. */
export function unlockAfterCheckinAd(state: PlnlState): PlnlState {
  return { ...state, adUnlocked: true };
}

/**
 * 달력 날짜 직접 탭 — done ↔ missed 토글(빈 칸은 done 으로). 목업 cycleDay 와 동일하게
 * **게이팅/포인트 없이** 기록만 보정한다(과거 출석 백필 용도).
 *
 * ⚠️ 결정 필요(TODO): 비로그인 유저가 달력으로 '오늘'을 done 처리하면 무료 3회/광고
 * 게이트를 우회할 수 있다. 또 로그인 유저는 달력 기록 시 +1P 가 안 붙는다(버튼만 +1P).
 * 목업의 동작을 그대로 옮긴 것 — 출시 전 정책 확정:
 *   (a) 달력은 과거 보정 전용(오늘은 버튼으로만) / (b) 달력 today 도 게이팅 / (c) 현행 유지.
 */
export function cycleCalendarDay(state: PlnlState, dateStr: string): PlnlState {
  const cur = state.logs[dateStr];
  const nextVal: LogValue = cur === "done" ? "missed" : "done";
  return { ...state, logs: { ...state.logs, [dateStr]: nextVal } };
}

/** 특정 달 출석 기록 전체 초기화 (목업 resetMonth). */
export function clearMonth(state: PlnlState, y: number, m: number): PlnlState {
  const prefix = monthPrefix(y, m);
  const logs: Logs = {};
  for (const [k, v] of Object.entries(state.logs)) {
    if (!k.startsWith(prefix)) logs[k] = v;
  }
  return { ...state, logs };
}
