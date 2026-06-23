// 사용자 액션 — 서버 권위(server-authoritative) 비즈니스 로직.
// 복사 위치: plnl.vercel.app/lib/aits/userActions.ts
//
// 왜 서버에서 다시 계산하나 (변조 방지):
//   회수율·단가·기부액은 '진실 숫자'라 클라이언트 계산을 신뢰해도 되지만(출석 기록만 진짜면 됨),
//   points / freezes / frozen 은 '보상 경제'라 클라가 임의 값을 supabase 에 쓰면 안 된다.
//   → 액션 라우트가 현재 row 를 읽어 **여기 reducer 로 서버에서 다시 계산**하고, 그 결과만 upsert.
//   클라는 "무엇을 했다"(checkin/claim/buy/resolve)만 보내고, 증감폭은 서버가 정한다.
//
// 이 reducer 들은 클라이언트 src/lib 의 순수 함수와 1:1 로 맞춘다 — 드리프트 시 양쪽을 함께 고친다:
//   attendance.applyCheckIn · milestones.applyMilestoneClaim · freeze.applyBuyFreeze/applyFreezeFromAd
//   streak.currentStreak/detectFreezeRepair/applyFreezeRepair/declineFreezeRepair · usePlnl.setSettings

import type { PlnlRow } from "@/lib/aits/db";

// ── 정책 상수 (클라 src/lib/constants.ts · content.ts 와 동일값) ────────────
const POINT_PER_CHECKIN = 1;
const FREEZE_COST_POINTS = 5;
const FREEZE_RECONCILE_LOOKBACK_DAYS = 60;
const STREAK_MILESTONES: { d: number; p: number }[] = [
  { d: 3, p: 2 },
  { d: 7, p: 5 },
  { d: 14, p: 10 },
  { d: 30, p: 30 },
];
/** 기록 시작 경계 — 이 날 이전은 거부(클라 CALENDAR_MIN_YEAR/MONTH = 2026-01). */
const MIN_DATE = "2026-01-01";

export type LogValue = "done" | "missed";
export type ActionResult =
  | { ok: true; row: PlnlRow }
  | { ok: false; reason: string };

// ── 날짜 헬퍼 (KST 고정 — 서버 TZ 무관) ─────────────────────────────────────
// Date.now()+9h 한 뒤 getUTC* 로 읽으면 서버 타임존과 무관하게 KST 벽시계를 얻는다.
// (클라 date.ts 의 kstYearMonth 와 같은 철학 — 해외/시차 유저도 KST 기준 하루 경계 고정.)
export function kstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
export const pad = (n: number) => String(n).padStart(2, "0");
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
/** 'YYYY-MM-' 월 키. m 은 0-based. settlement 등 서버 모듈에서 재사용(클라 date.ts:monthPrefix 미러). */
export function monthPrefix(y: number, m: number): string {
  return `${y}-${pad(m + 1)}-`;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDateKey(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

// ── 스트릭 (클라 streak.ts 미러) ────────────────────────────────────────────
/** 오늘부터 거꾸로 done(+1)·frozen(끊김만 방지) 이어지는 연속 일수. 오늘 미체크면 0. */
export function currentStreak(
  logs: Record<string, LogValue>,
  frozen: readonly string[],
  now: Date = kstNow(),
): number {
  const frozenSet = new Set(frozen);
  let s = 0;
  const d = new Date(now);
  for (;;) {
    const k = ymd(d);
    if (logs[k] === "done") s++;
    else if (!frozenSet.has(k)) break;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return s;
}

export interface FreezeRepair {
  /** 메울 빈 날(정렬). 소비될 보호권 수 = days.length. */
  days: string[];
}
/** 직전 done 이후의 '그냥 안 연 날'을 보호권으로 전부 메울 수 있을 때만 제안. 아니면 null. */
export function detectFreezeRepair(
  row: PlnlRow,
  now: Date = kstNow(),
): FreezeRepair | null {
  const frozenSet = new Set(row.frozen);
  const days: string[] = [];
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1); // 오늘 제외 — 어제부터
  let anchorFound = false;
  for (let i = 0; i < FREEZE_RECONCILE_LOOKBACK_DAYS; i++) {
    const k = ymd(d);
    if (k < MIN_DATE) break;
    const v = row.logs[k];
    if (v === "done") {
      anchorFound = true;
      break;
    }
    if (v === "missed") return null; // 본인이 인정한 결석 → 복구 대상 아님
    if (!frozenSet.has(k)) days.push(k);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  if (!anchorFound || days.length === 0) return null;
  if (row.freezes < days.length) return null; // all-or-nothing
  return { days: days.sort() };
}

// ── 액션 reducer (모두 순수, 서버 권위) ─────────────────────────────────────

/**
 * 출석 체크. 서버는 로그인 유저만 다루므로 신규 기록 시 항상 +1P(클라 applyCheckIn 의 loggedIn 분기).
 * 같은 값 재호출이면 토글 오프(기록 삭제, 포인트 환불 없음 — 클라와 동일).
 * 미래(KST 오늘 초과)·형식오류·기록경계 이전 날짜는 거부.
 */
export function serverCheckin(
  row: PlnlRow,
  date: unknown,
  value: unknown,
  now: Date = kstNow(),
): ActionResult {
  if (value !== "done" && value !== "missed") return { ok: false, reason: "bad_value" };
  if (!isValidDateKey(date)) return { ok: false, reason: "bad_date" };
  if (date < MIN_DATE) return { ok: false, reason: "before_min" };
  if (date > ymd(now)) return { ok: false, reason: "future_date" };

  const already = row.logs[date];
  const logs = { ...row.logs };
  let points = row.points;
  if (!already) points += POINT_PER_CHECKIN; // 신규 기록만 적립(로그인 유저)
  if (already === value) delete logs[date]; // 같은 값 → 토글 오프
  else logs[date] = value;
  return { ok: true, row: { ...row, logs, points } };
}

/**
 * 스트릭 마일스톤 수령(광고 시청 완료 후 호출). d 도달 + 미수령일 때만 +보너스P.
 * 클라 milestones.applyMilestoneClaim + nextClaimableMilestone 검증을 서버가 다시 한다.
 */
export function serverClaimMilestone(
  row: PlnlRow,
  d: unknown,
  now: Date = kstNow(),
): ActionResult {
  const m = STREAK_MILESTONES.find((x) => x.d === d);
  if (!m) return { ok: false, reason: "bad_milestone" };
  if (row.claimed_milestones.includes(m.d)) return { ok: false, reason: "already_claimed" };
  if (currentStreak(row.logs, row.frozen, now) < m.d) return { ok: false, reason: "not_reached" };
  return {
    ok: true,
    row: {
      ...row,
      points: row.points + m.p,
      claimed_milestones: [...row.claimed_milestones, m.d].sort((a, b) => a - b),
    },
  };
}

/** 보호권 포인트 구매 — points ≥ 5 검증 후 -5P, +1 보호권. */
export function serverBuyFreeze(row: PlnlRow): ActionResult {
  if (row.points < FREEZE_COST_POINTS) return { ok: false, reason: "insufficient_points" };
  return {
    ok: true,
    row: { ...row, points: row.points - FREEZE_COST_POINTS, freezes: row.freezes + 1 },
  };
}

/**
 * 보상형 광고(30초) 시청 완료 → +1 보호권(포인트 차감 없음).
 * TODO(광고검증): 가능하면 토스 보상형 광고 완료 토큰을 서버에서 검증해 위조 차단. v1 은 신뢰.
 */
export function serverFreezeFromAd(row: PlnlRow): ActionResult {
  return { ok: true, row: { ...row, freezes: row.freezes + 1 } };
}

/** 설정 변경 — fee ≥ 0, target ≥ 1 클램프. 적어도 하나는 있어야 함. */
export function serverSettings(
  row: PlnlRow,
  fee: unknown,
  target: unknown,
): ActionResult {
  const hasFee = typeof fee === "number" && Number.isFinite(fee);
  const hasTarget = typeof target === "number" && Number.isFinite(target);
  if (!hasFee && !hasTarget) return { ok: false, reason: "no_fields" };
  return {
    ok: true,
    row: {
      ...row,
      fee: hasFee ? Math.max(0, Math.floor(fee as number)) : row.fee,
      target: hasTarget ? Math.max(1, Math.floor(target as number)) : row.target,
    },
  };
}

/**
 * 보호권 복구 제안 해결(확인 후 복구). 서버가 detectFreezeRepair 로 메울 날을 **직접 계산**하므로
 * 클라가 임의 날짜를 frozen 으로 주입할 수 없다(변조 방지의 핵심).
 *   - accept=true  → 그 날들을 frozen 에 넣고 보호권 차감(applyFreezeRepair)
 *   - accept=false → 그 날들을 'missed' 로 기록(declineFreezeRepair, 다시 안 물음)
 *   - 제안할 게 없으면(null) no-op 성공(멱등).
 */
export function serverResolveRepair(
  row: PlnlRow,
  accept: unknown,
  now: Date = kstNow(),
): ActionResult {
  if (typeof accept !== "boolean") return { ok: false, reason: "bad_accept" };
  const repair = detectFreezeRepair(row, now);
  if (!repair) return { ok: true, row }; // 제안 없음 — 멱등 no-op
  if (accept) {
    const frozen = [...row.frozen, ...repair.days].sort();
    return { ok: true, row: { ...row, frozen, freezes: row.freezes - repair.days.length } };
  }
  const logs = { ...row.logs };
  for (const k of repair.days) logs[k] = "missed";
  return { ok: true, row: { ...row, logs } };
}
