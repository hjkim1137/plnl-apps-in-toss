// 앱 상태 모델 + 방어적 정규화.
// PlnlState 는 클라이언트의 단일 진실 소스. 로그인 시 일부 필드(fee/target/logs/points/
// freezes/frozen/claimed)는 서버에 영속되고, lastSeenMonth/notifyAgreed
// 는 기기 로컬 전용이다. (서버 매핑은 userData.ts 참고)

import {
  CALENDAR_MIN_MONTH,
  CALENDAR_MIN_YEAR,
  DEFAULT_FEE,
  DEFAULT_TARGET,
} from "./constants";
import { monthPrefix, parseYmd, ymd } from "./date";

export type LogValue = "done" | "missed";
export type Logs = Record<string, LogValue>;

/** 한 달치 운동 설정(운동비/목표 횟수) 스냅샷. */
export interface MonthSetting {
  fee: number;
  target: number;
}

export interface PlnlState {
  /** 한 달 운동 비용(원). */
  fee: number;
  /** 이번 달 목표 운동 횟수. */
  target: number;
  /** 이번 주 목표 운동 횟수(≥1). 회수율 계산과 무관한 개인 목표값. */
  weeklyTarget: number;
  /** 출석 기록. 'YYYY-MM-DD' → 'done' | 'missed'. */
  logs: Logs;
  /** 토스 로그인 여부. */
  loggedIn: boolean;
  /** 누적 포인트(≥0). */
  points: number;
  /** 보유 스트릭 보호권 개수(≥0). */
  freezes: number;
  /**
   * 보호권으로 보호된 날짜 키 목록('YYYY-MM-DD'). 자동 소비(reconcile)로 채워진다.
   * ⚠️ 출석('done')이 아니다 — 진실 숫자(회수율·기부액)에는 포함되지 않고, 스트릭 연속만
   * 이어준다(streak.ts). logs 와 독립.
   */
  frozen: string[];
  /** 수령 완료한 스트릭 마일스톤 일수 목록 (중복 지급 방지). */
  claimed: number[];
  /**
   * 오늘 탭에서 실제로 출석 체크한 날짜('YYYY-MM-DD'). **스트릭·등급(누적 인증)은 이 집합으로만 센다.**
   * 월간현황 달력(cycleDay) 수동 보정은 회수율·본전졸업 통계(logs)에만 반영되고 스트릭·등급엔
   * 포함하지 않는다.
   */
  checkins: string[];
  /** 결산 광고를 끝까지 본 달('YYYY-MM') 목록 — 재로그인·달이동해도 열람 유지(서버 영속). */
  reportSeen: string[];
  /** 표창장 광고를 끝까지 본 달('YYYY-MM') 목록 — 재로그인·달이동해도 열람 유지(서버 영속). */
  certSeen: string[];
  /** 마지막으로 앱을 연 달(monthIndex = y*12+m). 월 경계 도착 트리거 판정용. 0=미설정. */
  lastSeenMonth: number;
  /** 알림(스마트 발송) 수신 동의 완료 — 중복 동의 요청 방지. */
  notifyAgreed: boolean;
  /**
   * 보상 팝업을 이미 보여준 마일스톤 일수 목록(3·7·14·30). 마일스톤당 **최초 1회**만 노출
   * (오늘 체크를 토글해도, 다음 날에도 재노출 안 함). 기기 로컬 전용(서버 row 미저장).
   */
  streakMilestoneSeen: number[];
  /**
   * 스트릭 끊김 위로 팝업을 마지막으로 보여준 끊김 앵커('YYYY-MM-DD' = 잃은 스트릭의 마지막 출석일).
   * 끊김당 1회 노출 마커. 기기 로컬 전용. ""=아직 안 봄.
   */
  streakBrokenSeenOn: string;
  /**
   * 주간 목표(라디오 2~5회) 신규 기능 안내 팝업을 이미 봤는지 여부. 기존 사용자에게 최초
   * 1회만 노출하기 위한 마커. 기기 로컬 전용(서버 row 미저장).
   */
  weeklyGoalAnnounceSeen: boolean;
  /**
   * 운동비·주 목표(weeklyTarget)를 확정(잠금)한 달('YYYY-MM'). 이 값이 현재 달과 같으면 그 달엔
   * 수정 불가(달 최초 1회만 입력). 달이 바뀌면 다시 설정 가능. 기기 로컬 전용. ""=아직 확정 안 함.
   */
  settingsMonth: string;
  /**
   * 월별 운동 설정 스냅샷 'YYYY-MM' → {fee, target}. 과거 달은 그 달에 설정한 값으로 동결되고,
   * 편집은 현재 달만 가능하다(usePlnl.setSettings). 통계(낸돈/회수/기부)는 이 값으로 계산.
   * 스냅샷이 없는 달은 현재 fee/target 으로 폴백.
   */
  monthSettings: Record<string, MonthSetting>;
}

export function createInitialState(): PlnlState {
  return {
    fee: DEFAULT_FEE,
    target: DEFAULT_TARGET,
    weeklyTarget: 3,
    logs: {},
    loggedIn: false,
    points: 0,
    freezes: 0,
    frozen: [],
    claimed: [],
    checkins: [],
    reportSeen: [],
    certSeen: [],
    lastSeenMonth: 0,
    notifyAgreed: false,
    streakMilestoneSeen: [],
    streakBrokenSeenOn: "",
    weeklyGoalAnnounceSeen: false,
    settingsMonth: "",
    monthSettings: {},
  };
}

/** 'YYYY-MM' 월 키 정규화 — 형식 맞으면 그대로, 아니면 "". */
function sanitizeMonthKey(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? v : "";
}

/** 날짜 마커('YYYY-MM-DD') 정규화 — 형식만 검사(범위 무관, 시계 오차에도 마커 보존). 아니면 "". */
function sanitizeDayMarker(v: unknown): string {
  return typeof v === "string" && parseYmd(v) != null ? v : "";
}

// ── 정규화 헬퍼 (변조/손상 payload 방어) ──────────────────────────────────

function nonNegInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function posInt(v: unknown, fallback: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** 기록 시작 경계 'YYYY-MM-DD' (이 날 이전은 폐기). streak.ts 등에서 재사용. */
export const MIN_DATE = monthPrefix(CALENDAR_MIN_YEAR, CALENDAR_MIN_MONTH) + "01";

/** 허용된 날짜 키 + 값만 통과. 미래/형식오류/CALENDAR_MIN 이전은 폐기. */
export function sanitizeLogs(v: unknown, now: Date = new Date()): Logs {
  if (v == null || typeof v !== "object") return {};
  const today = ymd(now);
  const out: Logs = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val !== "done" && val !== "missed") continue;
    if (parseYmd(k) == null) continue;
    if (k < MIN_DATE) continue; // 기록 시작 이전
    if (k > today) continue; // 미래 날짜 차단
    out[k] = val;
  }
  return out;
}

/** 날짜 키 목록 정규화 — 유효 'YYYY-MM-DD'(기록 시작~오늘)만, 중복 제거·정렬. */
export function sanitizeDateList(v: unknown, now: Date = new Date()): string[] {
  if (!Array.isArray(v)) return [];
  const today = ymd(now);
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "string") continue;
    if (parseYmd(item) == null) continue;
    if (item < MIN_DATE || item > today) continue;
    seen.add(item);
  }
  return Array.from(seen).sort();
}

/** 'YYYY-MM' 월 키 목록 정규화 — 형식 맞는 것만, 중복 제거·정렬. */
export function sanitizeMonthList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === "string" && /^\d{4}-\d{2}$/.test(item)) seen.add(item);
  }
  return Array.from(seen).sort();
}

/** 월별 설정 정규화 — 'YYYY-MM' 키 + {fee≥0, target≥1} 만 통과. */
export function sanitizeMonthSettings(v: unknown): Record<string, MonthSetting> {
  const out: Record<string, MonthSetting> = {};
  if (v == null || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(k) || val == null || typeof val !== "object") continue;
    const o = val as Record<string, unknown>;
    out[k] = { fee: nonNegInt(o.fee, DEFAULT_FEE), target: posInt(o.target, DEFAULT_TARGET) };
  }
  return out;
}

/** 마일스톤 일수 목록 정규화 — 양수 정수만, 중복 제거. */
function sanitizeClaimed(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  for (const item of v) {
    const n = Math.floor(Number(item));
    if (Number.isFinite(n) && n > 0) seen.add(n);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

/** localStorage/서버에서 읽은 raw 를 안전한 PlnlState 로. */
export function normalizeState(
  raw: unknown,
  now: Date = new Date(),
): PlnlState {
  const base = createInitialState();
  if (raw == null || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    fee: nonNegInt(o.fee, base.fee),
    target: posInt(o.target, base.target),
    weeklyTarget: posInt(o.weeklyTarget, 3),
    logs: sanitizeLogs(o.logs, now),
    loggedIn: o.loggedIn === true,
    points: nonNegInt(o.points),
    freezes: nonNegInt(o.freezes),
    frozen: sanitizeDateList(o.frozen, now),
    claimed: sanitizeClaimed(o.claimed),
    checkins: sanitizeDateList(o.checkins, now),
    reportSeen: sanitizeMonthList(o.reportSeen),
    certSeen: sanitizeMonthList(o.certSeen),
    lastSeenMonth: nonNegInt(o.lastSeenMonth),
    notifyAgreed: o.notifyAgreed === true,
    streakMilestoneSeen: sanitizeClaimed(o.streakMilestoneSeen),
    streakBrokenSeenOn: sanitizeDayMarker(o.streakBrokenSeenOn),
    weeklyGoalAnnounceSeen: o.weeklyGoalAnnounceSeen === true,
    settingsMonth: sanitizeMonthKey(o.settingsMonth),
    monthSettings: sanitizeMonthSettings(o.monthSettings),
  };
}
