// 연속 출석 스트릭 (기획 §5.2·§6.1). 로그인 유저 전용 표시.
// 출처: 목업 streakNow / maxStreak / bestStreakAll.
//
// 보호권(freeze) 모델 = 확인 후 복구(opt-in):
//   - 앱을 열거나 로그인하면 detectFreezeRepair 가 직전 'done' 이후의 '그냥 안 연 날(기록 없음)'
//     을 찾는다. 보유 보호권으로 전부 메울 수 있을 때만(all-or-nothing) 사용자에게 복구를 제안.
//   - 동의 → applyFreezeRepair: 그 날들을 frozen 에 넣고 보호권을 차감.
//     거절 → declineFreezeRepair: 그 날들을 'missed' 로 기록(본인이 끊김 수용 → 다시 안 물음).
//     ⇒ 방패는 사용자가 동의하기 전엔 절대 차감되지 않는다.
//   - currentStreak 는 'done'(+1) 과 'frozen'(끊김 방지 + 카운트 +1) 을 이어서 연속을 센다.
//     보호권으로 메운 날도 "n일 연속 인증 중"에 포함된다(사용자 체감상 유지된 연속).
//   - 진실 숫자(회수율·기부액, calc.ts)는 'done' 만 보므로 frozen 의 영향을 받지 않는다.

import { BROKEN_MIN_STREAK, FREEZE_RECONCILE_LOOKBACK_DAYS } from "./constants";
import { dayKey, daysInMonth, parseYmd, ymd } from "./date";
import { nextClaimableMilestone } from "./milestones";
import { MIN_DATE, type Logs, type PlnlState } from "./model";

/**
 * 오늘 기준 연속 출석 일수. 오늘부터 거꾸로, 'done'(카운트 +1) 과 'frozen'(보호 — 끊김 방지 +
 * 카운트 +1) 이 이어지는 한 계속한다. 보호권으로 메운 날도 연속 일수에 포함된다.
 * ⚠️ 오늘을 아직 'done' 으로 체크 안 했으면 0 으로 보인다(어제까지 N일이어도).
 * = "오늘 출석해야 스트릭이 살아있다"는 푸시 의도. 보호권은 과거의 빠진 날만 메우고, 오늘은
 * 아직 빠진 게 아니므로 복구 대상이 아니다(detectFreezeRepair 도 오늘은 보지 않음).
 */
export function currentStreak(
  checkins: readonly string[],
  frozen: readonly string[] = [],
  now: Date = new Date(),
): number {
  const checkinSet = new Set(checkins);
  const frozenSet = new Set(frozen);
  let s = 0;
  const d = new Date(now);
  for (;;) {
    const k = ymd(d);
    if (checkinSet.has(k) || frozenSet.has(k)) s++; // 출석·보호권 둘 다 카운트
    else break; // 오늘탭 출석(checkin)도 frozen 도 아니면 끊김
    d.setDate(d.getDate() - 1);
  }
  return s;
}

/**
 * 화면·마일스톤 표시용 연속. 오늘 체크했으면 오늘 포함, 아직이면 **어제까지 이어온 연속**(오늘은 유예)을
 * 보여준다 — "오늘 인증 전에도 그동안 쌓은 연속을 그대로 표시". 완전히 끊겨야(어제 기준도 0) 0.
 * 보호권으로 어제 빈 날을 메운 경우, 오늘 인증 전에도 그 연속(예: 4일)이 표시된다.
 * (푸시 의도의 currentStreak 는 그대로 유지 — 이건 표시 전용 파생값.)
 */
export function livingStreak(
  checkins: readonly string[],
  frozen: readonly string[] = [],
  now: Date = new Date(),
): number {
  const today = currentStreak(checkins, frozen, now);
  if (today > 0) return today;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return currentStreak(checkins, frozen, yesterday);
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
  const checkinSet = new Set(state.checkins);
  const days: string[] = []; // 직전 출석(checkin) 이후의 빈 날(어제→과거 순)
  const d = new Date(now);
  d.setDate(d.getDate() - 1); // 오늘 제외 — 어제부터
  let anchorFound = false;
  for (let i = 0; i < FREEZE_RECONCILE_LOOKBACK_DAYS; i++) {
    const k = ymd(d);
    if (k < MIN_DATE) break; // 기록 시작 이전
    if (checkinSet.has(k)) {
      anchorFound = true; // 오늘탭 출석 앵커 — 여기서 멈춘다
      break;
    }
    if (state.logs[k] === "missed") return null; // 본인이 인정한 결석 → 복구 대상 아님
    if (!frozenSet.has(k)) days.push(k); // 출석 아닌 빈 날(이미 frozen 이면 이어주되 제외)
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

/** 특정 달(y, m: 0-based)의 최장 연속 출석(오늘탭 checkin 기준). 결산 리포트용. */
export function maxStreakInMonth(checkins: readonly string[], y: number, m: number): number {
  const checkinSet = new Set(checkins);
  const days = daysInMonth(y, m);
  let mx = 0;
  let cur = 0;
  for (let d = 1; d <= days; d++) {
    const k = dayKey(y, m, d);
    if (checkinSet.has(k)) {
      cur++;
      mx = Math.max(mx, cur);
    } else {
      cur = 0;
    }
  }
  return mx;
}

/**
 * 전체 기록 통틀어 최장 연속(달 경계 무관). checkins 와 frozen(보호권으로 메운 날)의 합집합으로
 * 센다 — currentStreak 와 규칙을 맞춰 "현재 스트릭 > 최고 기록" 모순을 막는다.
 */
export function bestStreakAll(
  checkins: readonly string[],
  frozen: readonly string[] = [],
): number {
  const keys = Array.from(new Set([...checkins, ...frozen])).sort();
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

/**
 * 앱 진입/체크인 순간에 띄울 스트릭 상태 팝업(기획 §2·§3). 순수 감지만 — 노출 마커 기록은 화면이 담당.
 * 팝업은 딱 2종:
 * - milestone: 리빙 연속(livingStreak)이 3·7·14·30일에 도달·미수령. 보상 수령.
 *   마일스톤당 **최초 1회**(streakMilestoneSeen) — 오늘 체크를 토글하거나 다음 날 와도 재노출 안 함.
 * - broken: 완전히 끊김(리빙 연속 0). 끊김당 1회(streakBrokenSeenOn = 잃은 스트릭 앵커).
 *   복구 제안이 있으면(detectFreezeRepair≠null) 복구 카드가 우선이라 null.
 */
export type StreakStatusPopup =
  | { kind: "milestone"; streak: number; milestone: number }
  | { kind: "broken"; lostStreak: number; anchor: string };

export function detectStreakStatusPopup(
  state: PlnlState,
  now: Date = new Date(),
): StreakStatusPopup | null {
  if (!state.loggedIn) return null; // 스트릭은 로그인 전용 표시

  // 복구 제안이 있으면(빈 날을 보호권으로 메울 수 있으면) 복구 팝업이 **최우선** — 마일스톤·끊김 모두 양보.
  // "보호권 먼저 쓸래?"를 물은 뒤에 그 결과(리빙 연속/마일스톤)를 보여준다.
  if (detectFreezeRepair(state, now) != null) return null;

  const living = livingStreak(state.checkins, state.frozen, now);

  // milestone: 리빙 연속이 3·7·14·30일에 도달·미수령이고 그 마일스톤 팝업을 아직 안 봤으면 보상 팝업.
  // (보호권으로 어제 메워 오늘 인증 전이어도 도달했으면 노출. streakMilestoneSeen 으로 마일스톤당 1회.)
  const claimable = nextClaimableMilestone(living, state.claimed);
  if (claimable != null && !state.streakMilestoneSeen.includes(claimable.d)) {
    return { kind: "milestone", streak: living, milestone: claimable.d };
  }

  // broken: 리빙 연속이 0(오늘·어제 모두 0) 이어야 진짜 끊김. 살아있으면 위에서 처리됨.
  if (living !== 0) return null;
  if (state.checkins.length === 0) return null; // 끊길 기록 자체가 없음

  // 잃은 스트릭 = 마지막 출석일(앵커) 시점의 연속. checkins 는 sanitizeDateList 로 정렬 보장.
  const anchor = state.checkins[state.checkins.length - 1];
  const anchorDate = parseYmd(anchor);
  if (anchorDate == null) return null;
  const lostStreak = currentStreak(state.checkins, state.frozen, anchorDate);
  if (lostStreak < BROKEN_MIN_STREAK) return null; // 1일 끊김은 소음
  if (state.streakBrokenSeenOn === anchor) return null; // 이 끊김은 이미 봄

  return { kind: "broken", lostStreak, anchor };
}
