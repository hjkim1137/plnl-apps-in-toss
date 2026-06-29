// 핵심 계산 엔진 — 회수율/단가/기부액/본전. 앱의 '진실 숫자'.
// 기획 §4 확정안. 포인트·보상 등 게임 요소로 절대 조작되지 않는다(불변 원칙).
// 출처: 목업 compute() 와 동일 공식.

import { round1 } from "./format";
import type { Logs } from "./model";

export interface MonthStats {
  /** 입력값 (정규화 후). */
  fee: number;
  target: number;
  /** 출석/결석 일수. */
  done: number;
  missed: number;
  /** 1회 운동 단가 = fee / target. */
  unit: number;
  /** 회수한 금액 = unit * done. */
  recovered: number;
  /** 정밀 회수율(%) = done / target * 100. */
  rateRaw: number;
  /** 표기용 회수율(소수1자리). */
  rate: number;
  /** 본전까지 남은 횟수 = max(0, target - done). */
  remain: number;
  /** 누적 기부액 = max(0, fee - recovered). */
  donate: number;
  /** 초과 회수액 = max(0, recovered - fee). 100% 초과 시. */
  over: number;
}

/** 1회 운동 단가. target 은 최소 1로 가드. */
export function unitCost(fee: number, target: number): number {
  return Math.max(0, fee) / Math.max(1, target);
}

/**
 * 입력/활동이 없는 달의 빈 통계 — 낸 돈 0원·목표 0회·회수율 0%.
 * 설정값(fee/target)은 '현재 달'에만 귀속하므로, 로그도 없는 과거 달은 이 값으로 표기한다.
 * computeMonth 는 target 을 최소 1로 가드하지만 빈 달은 '0회'로 보여야 해 별도 상수로 분리.
 */
export const EMPTY_MONTH_STATS: MonthStats = {
  fee: 0,
  target: 0,
  done: 0,
  missed: 0,
  unit: 0,
  recovered: 0,
  rateRaw: 0,
  rate: 0,
  remain: 0,
  donate: 0,
  over: 0,
};

/** 한 달치 로그로 모든 진실 숫자를 산출. monthLogs 는 해당 달만 필터된 로그. */
export function computeMonth(
  fee: number,
  target: number,
  monthLogs: Logs,
): MonthStats {
  const f = Math.max(0, fee);
  const t = Math.max(1, target);
  let done = 0;
  let missed = 0;
  for (const v of Object.values(monthLogs)) {
    if (v === "done") done++;
    else if (v === "missed") missed++;
  }
  const unit = f / t;
  const recovered = unit * done;
  const rateRaw = (done / t) * 100;
  const remain = Math.max(0, t - done);
  const donate = Math.max(0, f - recovered);
  const over = Math.max(0, recovered - f);
  return {
    fee: f,
    target: t,
    done,
    missed,
    unit,
    recovered,
    rateRaw,
    rate: round1(rateRaw),
    remain,
    donate,
    over,
  };
}

/** "오늘의 선택" 값 — 오늘 가면 +unit 회수, 안 가면 unit 증발. */
export interface TodayChoice {
  /** 오늘 가면 회수되는 금액(=단가). */
  goReward: number;
  /** 오늘 안 가면 증발하는 금액(=단가). */
  skipLoss: number;
  /** 오늘 가면 도달하는 회수율(소수1자리). */
  projectedRateIfGo: number;
}

export function todayChoice(stats: MonthStats): TodayChoice {
  return {
    goReward: stats.unit,
    skipLoss: stats.unit,
    projectedRateIfGo: round1(((stats.done + 1) / stats.target) * 100),
  };
}
