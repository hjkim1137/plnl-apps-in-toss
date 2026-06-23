// 연속 출석 스트릭 (기획 §5.2·§6.1). 로그인 유저 전용 표시.
// 출처: 목업 streakNow / maxStreak / bestStreakAll.
//
// 보호권(freeze) 모델 = 확인 후 복구(opt-in):
//   - 앱을 열거나 로그인하면 detectFreezeRepair 가 직전 'done' 이후의 '그냥 안 연 날(기록 없음)'
//     을 찾는다. 보유 보호권으로 전부 메울 수 있을 때만(all-or-nothing) 사용자에게 복구를 제안.
//   - 동의 → applyFreezeRepair: 그 날들을 frozen 에 넣고 보호권을 차감.
//     거절 → declineFreezeRepair: 그 날들을 'missed' 로 기록(본인이 끊김 수용 → 다시 안 물음).
//     ⇒ 방패는 사용자가 동의하기 전엔 절대 차감되지 않는다.
//   - currentStreak 는 'done'(+1) 과 'frozen'(끊김만 방지, 카운트 X) 을 이어서 연속을 센다.
//   - 진실 숫자(회수율·기부액, calc.ts)는 'done' 만 보므로 frozen 의 영향을 받지 않는다.

import { FREEZE_RECONCILE_LOOKBACK_DAYS } from "./constants";
import { dayKey, daysInMonth, parseYmd, ymd } from "./date";
import { MIN_DATE, type Logs, type PlnlState } from "./model";

/**
 * 오늘 기준 연속 출석 일수. 오늘부터 거꾸로, 'done'(카운트 +1) 과 'frozen'(보호 — 끊김만 방지,
 * 카운트 안 함) 이 이어지는 한 계속한다.
 * ⚠️ 오늘을 아직 'done' 으로 체크 안 했으면 0 으로 보인다(어제까지 N일이어도).
 * = "오늘 출석해야 스트릭이 살아있다"는 푸시 의도. 보호권은 과거의 빠진 날만 메우고, 오늘은
 * 아직 빠진 게 아니므로 복구 대상이 아니다(detectFreezeRepair 도 오늘은 보지 않음).
 */
export function currentStreak(
  logs: Logs,
  frozen: readonly string[] = [],
  now: Date = new Date(),
): number {
  const frozenSet = new Set(frozen);
  let s = 0;
  const d = new Date(now);
  for (;;) {
    const k = ymd(d);
    if (logs[k] === "done") s++;
    else if (!frozenSet.has(k)) break; // 'done' 도 'frozen' 도 아니면 끊김
    d.setDate(d.getDate() - 1);
  }
  return s;
}

export interface FreezeRepair {
  /** 보호권으로 메울 빈 날들('YYYY-MM-DD', 정렬). 소비될 보호권 수 = days.length. */
  days: string[];
}

/**
 * 보호권 복구 '제안' 감지. 앱 마운트·로그인 직후에 호출(usePlnl) — 여기서는 **차감하지 않는다**.
 *
 * 직전 'done' 과 오늘 사이의 '그냥 안 연 날(기록이 아예 없는 날)'을 찾는다.
 * - 오늘은 아직 빠진 게 아니므로 제외(어제부터 본다).
 * - 명시적 'missed'(본인이 "안 갔어요"로 찍음)를 만나면 → 끊김을 받아들인 것이라 복구 안 함(null).
 * - 이미 frozen 인 날은 이어주되 다시 세지 않는다.
 * - **all-or-nothing**: 빈 날 전부를 보유 보호권으로 메울 수 있을 때만 제안(아니면 null).
 * - 앵커('done')를 LOOKBACK 일 안에서 못 찾으면 살릴 스트릭이 없는 것 → null.
 *
 * @returns 제안할 게 있으면 { days }, 없으면 null.
 */
export function detectFreezeRepair(
  state: PlnlState,
  now: Date = new Date(),
): FreezeRepair | null {
  const frozenSet = new Set(state.frozen);
  const days: string[] = []; // 직전 done 이후의 빈 날(어제→과거 순)
  const d = new Date(now);
  d.setDate(d.getDate() - 1); // 오늘 제외 — 어제부터
  let anchorFound = false;
  for (let i = 0; i < FREEZE_RECONCILE_LOOKBACK_DAYS; i++) {
    const k = ymd(d);
    if (k < MIN_DATE) break; // 기록 시작 이전
    const v = state.logs[k];
    if (v === "done") {
      anchorFound = true; // 스트릭 앵커 — 여기서 멈춘다
      break;
    }
    if (v === "missed") return null; // 본인이 인정한 결석 → 복구 대상 아님
    if (!frozenSet.has(k)) days.push(k); // 기록 없는 빈 날(이미 frozen 이면 이어주되 제외)
    d.setDate(d.getDate() - 1);
  }
  if (!anchorFound || days.length === 0) return null; // 살릴 스트릭/빈 날 없음
  if (state.freezes < days.length) return null; // 다 못 메움 → 제안 안 함(낭비 X)
  return { days: days.sort() };
}

/**
 * 복구 '동의' 시 적용. detectFreezeRepair().days 를 넘긴다 — 그 날들을 frozen 에 넣고 보호권 차감.
 * days 가 비었거나 보호권이 부족하면 그대로 반환(방어). 순수 함수.
 */
export function applyFreezeRepair(state: PlnlState, days: string[]): PlnlState {
  if (days.length === 0 || state.freezes < days.length) return state;
  const frozen = [...state.frozen, ...days].sort(); // days 는 frozen 과 disjoint(detect 가 제외함)
  return { ...state, frozen, freezes: state.freezes - days.length };
}

/**
 * 복구 '거절' 시 적용. 제안된 빈 날들을 'missed'(안 감)로 기록한다 — 본인이 끊김을 받아들인 것.
 * 보호권은 쓰지 않는다. 이후 detectFreezeRepair 가 그 날을 'missed' 로 보고 멈추므로 다시 묻지 않는다.
 */
export function declineFreezeRepair(state: PlnlState, days: string[]): PlnlState {
  if (days.length === 0) return state;
  const logs: Logs = { ...state.logs };
  for (const k of days) logs[k] = "missed";
  return { ...state, logs };
}

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
