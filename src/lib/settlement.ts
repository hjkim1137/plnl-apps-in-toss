// 월간 결산 & 표창장 (기획 §7). 결산/표창장 데이터(리포트·표창장 문구) 빌더.
// 회수율은 게이트가 아니라 '내용 분기' — 톤/표창장 종류만 바꾼다.
// 클라이언트 열람 게이트는 로그인 + 광고(reportSeen/certSeen)로만 한다(usePlnl).

import { isGraduated } from "./brackets";
import type { MonthStats } from "./calc";
import {
  certificateText,
  type CertificateText,
  MONTH_LABELS,
  reportGrade,
} from "./content";
import { NEXT_TARGET_STEP } from "./constants";

export interface MonthReport {
  year: number;
  monthLabel: string;
  rate: number;
  done: number;
  target: number;
  maxStreak: number;
  recovered: number;
  donate: number;
  over: number;
  graduated: boolean;
  /** 한 줄 총평. */
  grade: string;
  /** 다음 달 추천 목표 횟수. */
  nextTargetRecommendation: number;
}

/** 결산 리포트 데이터. maxStreak 는 streak.maxStreakInMonth 로 주입. */
export function buildReport(
  s: MonthStats,
  year: number,
  month: number,
  maxStreak: number,
): MonthReport {
  const graduated = isGraduated(s.rate);
  // 달성 시 +STEP 상향, 미달 시 실제 출석+STEP 과 기존 목표 중 큰 값 → 무리 없는 상향.
  const nextTarget = graduated
    ? s.target + NEXT_TARGET_STEP
    : Math.max(s.done + NEXT_TARGET_STEP, s.target);
  return {
    year,
    monthLabel: MONTH_LABELS[month],
    rate: s.rate,
    done: s.done,
    target: s.target,
    maxStreak,
    recovered: s.recovered,
    donate: s.donate,
    over: s.over,
    graduated,
    grade: reportGrade(s.rate),
    nextTargetRecommendation: nextTarget,
  };
}

export type CertificateKind = "graduation" | "sponsor";

export interface Certificate {
  /** graduation = 본전 졸업장(100%↑) / sponsor = 후원 표창장(미달). */
  kind: CertificateKind;
  text: CertificateText;
}

/** 표창장 데이터(종류 + 문구). 회수율 100% 기준으로 종류 분기. */
export function buildCertificate(
  s: MonthStats,
  year: number,
  month: number,
): Certificate {
  return {
    kind: isGraduated(s.rate) ? "graduation" : "sponsor",
    text: certificateText(s, year, MONTH_LABELS[month]),
  };
}
