// ─────────────────────────────────────────────────────────────────────────
// 콘텐츠/디자인 조정 영역 — 카피=선민(B), 색/이모지=인정(A).
// 로직(brackets.ts/titles.ts/milestones.ts)이 '키/수치'를 정하면, 여기서 그 키를
// 사람이 읽는 라벨·카피·색으로 매핑한다. 문구만 고쳐도 로직은 그대로 동작.
// 값(등급 컷·마일스톤 P)은 기획 §6 초안 — 밸런싱 확정 시 여기만 수정.
// ─────────────────────────────────────────────────────────────────────────

import { isGraduated, resolveBracketKey, type BracketKey } from "./brackets";
import type { MonthStats } from "./calc";
import { won } from "./format";
import type { LogValue } from "./model";

// ── 회수율 구간 비주얼 (badge 라벨/이모지/게이지색/헤드라인 배경) ──────────
export interface BracketVisual {
  label: string;
  emoji: string;
  barColor: string;
  bgGradient: string;
}

export const BRACKET_VISUALS: Record<BracketKey, BracketVisual> = {
  0: { label: "지갑만 운동러", emoji: "💳", barColor: "#8b95a1", bgGradient: "linear-gradient(135deg,#8b95a1,#6b7684)" },
  1: { label: "후원왕", emoji: "🥇", barColor: "#f04452", bgGradient: "linear-gradient(135deg,#f04452,#ff6b78)" },
  2: { label: "각성 직전", emoji: "🔥", barColor: "#ff8a00", bgGradient: "linear-gradient(135deg,#ff8a00,#ffab40)" },
  3: { label: "기부 → 운동 전환", emoji: "🏃", barColor: "#00c2c7", bgGradient: "linear-gradient(135deg,#00c2c7,#3dd6da)" },
  4: { label: "본전 임박", emoji: "😭", barColor: "#15b877", bgGradient: "linear-gradient(135deg,#15b877,#34d399)" },
  5: { label: "호구 졸업", emoji: "🎓", barColor: "#3182f6", bgGradient: "linear-gradient(135deg,#3182f6,#5a9cff)" },
  6: { label: "이젠 내가 갑", emoji: "🤑", barColor: "#ffb800", bgGradient: "linear-gradient(135deg,#a06800,#ffb800)" },
};

/** rate/done → 구간 키 + 비주얼을 한 번에. (logic resolveBracketKey + content 비주얼 결합) */
export function resolveBracketView(
  rate: number,
  done: number,
): { key: BracketKey } & BracketVisual {
  const key = resolveBracketKey(rate, done);
  return { key, ...BRACKET_VISUALS[key] };
}

// ── 구간별 헤드라인 — 회수율 카드 % 바 아래 한 줄. ───────────────────────────
// 앞의 "OOO 회원님," / "회원님," 인사는 usePlnl 에서 붙인다(여기선 본문만).
// 회수율 수치는 카드의 큰 숫자에 이미 노출되므로 헤드라인에서 "회수율 XX%!" 접두어는 뺀다.
// (이전 "회원님께 한마디" 목록은 제거됨.)
export function headlineFor(key: BracketKey, s: MonthStats): string {
  switch (key) {
    case 0:
      return "결제만 하고 지갑만 운동시키셨네요";
    case 1:
      return "이번 달 헬스장 기부왕이세요!";
    case 2:
      return "이제 막 시동 걸렸어요!";
    case 3:
      return "드디어 운동러로 갈아타는 중이에요";
    case 4:
      return `본전까지 딱 ${s.remain}회! 여기서 멈추면 너무 아까워요`;
    case 5:
      return "본전 달성! 이제부터 가는 건 전부 이득이에요";
    default:
      return "이젠 헬스장이 손해 보는 중이에요";
  }
}

/** 이번 달 회수율 카드 한 줄 상태 문구. */
export function monthStatusText(s: MonthStats): string {
  if (s.done === 0) return "운동시설이 회원님을 기다리는 중 🏋️";
  if (s.rate < 50) return "아직 한참 뽕 뽑을 수 있어요 💪";
  if (s.rate < 100) return "거의 다 회수했어요! 조금만 더 🔥";
  return "이번 달 운동비 완전 회수! 🎉";
}

// ── 대표 칭호(누적 인증 레벨) — 기획 §6.2 ─────────────────────────────────
export interface Level {
  /** 이 등급에 진입하는 누적 인증(오늘탭 출석) 최소치. */
  min: number;
  name: string;
  emoji: string;
}

export const LEVELS: Level[] = [
  { min: 0, name: "운동 새싹", emoji: "🌱" },
  { min: 3, name: "작심삼일러", emoji: "🔥" },
  { min: 10, name: "헬스 뉴비", emoji: "🏃" },
  { min: 25, name: "회수 전문가", emoji: "🎯" },
  { min: 45, name: "본전 사냥꾼", emoji: "💪" },
  { min: 80, name: "뽕 뽑기 달인", emoji: "🏆" },
  { min: 120, name: "명예 관장님", emoji: "👑" },
];

// ── 스트릭 마일스톤 보상 — 기획 §6.1 (전면형 광고 보고 포인트 수령) ────────
export interface StreakMilestone {
  /** 연속 출석 일수. */
  d: number;
  /** 보너스 포인트. */
  p: number;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { d: 3, p: 2 },
  { d: 7, p: 5 },
  { d: 14, p: 10 },
  { d: 30, p: 30 },
];

// ── 월간 결산 총평 / 표창장 문구 — 기획 §7 ────────────────────────────────
export function reportGrade(rate: number): string {
  if (isGraduated(rate)) return "완전 회수 🎉";
  if (rate >= 75) return "합격 👍";
  if (rate >= 50) return "분발 필요 💪";
  return "반성 모드 😅";
}

export interface CertificateText {
  title: string;
  /** 본문 (HTML <br/> 포함 가능 — 화면에서 렌더). */
  body: string;
  /** 스샷 공유용 텍스트. */
  share: string;
}

export function certificateText(
  s: MonthStats,
  year: number,
  monthLabel: string,
): CertificateText {
  const graduated = isGraduated(s.rate);
  if (graduated) {
    return {
      title: "본전 졸업장",
      body: "위 사람은 회수율 <b>100%</b>를 달성하여<br/>호구 명단에서 제명되었음을 이에 증명함 🎓",
      share: `나 ${monthLabel} 운동비 완전 회수함 💪🔥\n목표 ${s.target}회 달성, ${won(s.fee)} 뽕 뽑기 성공!\n\n#뺄래낼래`,
    };
  }
  return {
    title: "운동비 후원 표창장",
    body: `회원님께서는 ${year}년 ${monthLabel} 금 <b>${won(s.donate)}</b>을<br/>운동시설에 아낌없이 기부하셨기에<br/>이 상장을 수여합니다 👑`,
    share: `나 ${monthLabel} 운동비 ${s.rate}% 회수함\n아직 ${won(s.donate)} 기부 중… 😅\n\n#뺄래낼래`,
  };
}

export const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

// ── 오늘의 선택 — 출석 체크 후 상태 메시지 ─────────────────────────────────

export type CheckInStatusKind = "done" | "missed" | "neutral";

export interface CheckInStatus {
  text: string;
  kind: CheckInStatusKind;
}

/** 오늘 체크인 결과(또는 미체크) → 화면 하단 상태 메시지 + 스타일 분류. */
export function todayCheckInStatusText(
  todayValue: LogValue | null,
  unit: number,
  loggedIn: boolean,
): CheckInStatus {
  if (todayValue === "done") {
    return {
      text: `오늘 ${won(unit)} 회수 완료 💪${loggedIn ? " +1P" : ""}`,
      kind: "done",
    };
  }
  if (todayValue === "missed") {
    return {
      text: `오늘 ${won(unit)} 증발… 내일은 갈 거죠? 😅`,
      kind: "missed",
    };
  }
  return { text: "오늘 출석을 체크해보세요!", kind: "neutral" };
}

// ── 온보딩 슬라이드 — 기획 §5.0 (F1) ────────────────────────────────────────

export interface OnboardingSlide {
  emoji: string;
  title: string;
  body: string;
  /** 마지막 슬라이드 버튼 라벨 (undefined 면 "다음"). */
  cta?: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    emoji: "💳",
    title: "운동비, 뽑고 계세요?",
    body: "이번 달 결제한 운동비에서 얼마나 회수했는지 한눈에 확인해요.",
  },
  {
    emoji: "🏃",
    title: "갈수록 아까워지는 구조",
    body: "출석할수록 단가가 낮아져요. 안 가면 단가만큼 기부하는 셈이에요.",
  },
  {
    emoji: "🔔",
    title: "오늘의 선택",
    body: "오늘 가면 얼마 회수, 안 가면 얼마 증발. 매일 직관적으로 알려드려요.",
    cta: "시작하기",
  },
];

// ── 알림(스마트 발송) 카피 — F17 (B 관리) ─────────────────────────────────
// 인앱 카피(arrival 배너·동의 CTA)는 화면이 직접 렌더. PUSH_TEMPLATES 는 서버 스마트
// 발송 템플릿과 미러용 — 세그먼트별 본문의 단일 출처(실제 발송은 서버, docs/backend).

export const NOTIFY_COPY = {
  /** 월말 결산/표창장 도착 배너 제목. */
  arrivalTitle: (monthLabel: string) => `🎉 ${monthLabel} 표창장이 도착했어요!`,
  /** 도착 배너 → 결산/표창장으로 이동 버튼. */
  arrivalCta: "결산·표창장 보러 가기",
  /** 알림 수신 동의 유도 버튼. */
  enableCta: "🔔 다음 달부터 도착 알림 받기",
};

/** 서버 스마트 발송 본문 미러(세그먼트별). 실제 발송 트리거/세그먼트 정의는 백엔드. */
export const PUSH_TEMPLATES = {
  /** 매일 — 오늘 출석 유도. */
  daily: "오늘도 운동비 회수하러 가볼까요? 💪 안 가면 단가만큼 증발해요",
  /** 스트릭 끊김 위기 — 오늘 출석 필요. */
  streakRisk: (days: number) =>
    `🔥 ${days}일 연속 출석 중! 오늘 안 가면 끊겨요. 보호권으로 지킬 수도 있어요`,
  /** 마일스톤 도달 — 광고 보고 포인트 수령 가능. */
  milestoneReady: (days: number, p: number) =>
    `🎁 ${days}일 연속 달성! 광고 보고 +${p}P 받아가세요`,
  /** 월말 도착 — 결산/표창장 공개. */
  arrival: (monthLabel: string) =>
    `📊 ${monthLabel} 결산과 표창장이 도착했어요. 이번 달 회수율 확인해보세요!`,
};
