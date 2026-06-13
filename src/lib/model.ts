// 앱 상태 모델 + 방어적 정규화.
// PlnlState 는 클라이언트의 단일 진실 소스. 로그인 시 일부 필드(fee/target/logs/points/
// freezes/claimed)는 서버에 영속되고, freeUsed/adUnlocked 는 비로그인 로컬 전용이다.
// (서버 매핑은 userData.ts 참고)

import {
  CALENDAR_MIN_MONTH,
  CALENDAR_MIN_YEAR,
  DEFAULT_FEE,
  DEFAULT_TARGET,
} from "./constants";
import { monthPrefix, parseYmd, ymd } from "./date";

export type LogValue = "done" | "missed";
export type Logs = Record<string, LogValue>;

export interface PlnlState {
  /** 한 달 운동 비용(원). */
  fee: number;
  /** 이번 달 목표 운동 횟수. */
  target: number;
  /** 출석 기록. 'YYYY-MM-DD' → 'done' | 'missed'. */
  logs: Logs;
  /** 토스 로그인 여부. */
  loggedIn: boolean;
  /** 누적 포인트(≥0). */
  points: number;
  /** 보유 스트릭 보호권 개수(≥0). */
  freezes: number;
  /** 수령 완료한 스트릭 마일스톤 일수 목록 (중복 지급 방지). */
  claimed: number[];
  /** 비로그인 무료 출석 사용 횟수. */
  freeUsed: number;
  /** 광고 시청으로 1회 출석이 언락된 상태(비로그인). */
  adUnlocked: boolean;
}

export function createInitialState(): PlnlState {
  return {
    fee: DEFAULT_FEE,
    target: DEFAULT_TARGET,
    logs: {},
    loggedIn: false,
    points: 0,
    freezes: 0,
    claimed: [],
    freeUsed: 0,
    adUnlocked: false,
  };
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

const MIN_DATE = monthPrefix(CALENDAR_MIN_YEAR, CALENDAR_MIN_MONTH) + "01";

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
    logs: sanitizeLogs(o.logs, now),
    loggedIn: o.loggedIn === true,
    points: nonNegInt(o.points),
    freezes: nonNegInt(o.freezes),
    claimed: sanitizeClaimed(o.claimed),
    freeUsed: nonNegInt(o.freeUsed),
    adUnlocked: o.adUnlocked === true,
  };
}
