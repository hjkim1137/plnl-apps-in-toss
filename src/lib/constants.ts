// 정책 상수 (기획 §5·§6 확정값). 밸런싱 변경은 여기 한 곳에서.
// 보상값(마일스톤 P, 등급 컷 등)은 콘텐츠 성격이라 content.ts 에 둔다.

/** 비로그인 유저의 무료 출석 체크 횟수. 소진 후 전면형 광고 게이트. */
export const FREE_CHECKIN_LIMIT = 3;

/** 로그인 유저 출석 1회당 적립 포인트. */
export const POINT_PER_CHECKIN = 1;

/** 스트릭 보호권 1개 가격 (포인트). 보상형 광고로도 획득 가능(가격 0). */
export const FREEZE_COST_POINTS = 5;

/**
 * 보호권 자동 소비(reconcile) 시 스트릭 앵커(직전 'done')를 거슬러 찾는 최대 일수.
 * 이보다 오래 비운 경우는 새 출발로 보고 자동 보호하지 않는다(보호권 낭비 방지).
 */
export const FREEZE_RECONCILE_LOOKBACK_DAYS = 60;

/** 출석 달력 기록 시작 시점 (그 이전 달은 선택 불가). 0=1월. */
export const CALENDAR_MIN_YEAR = 2026;
export const CALENDAR_MIN_MONTH = 0; // 2026년 1월

/** 설정 기본값. */
export const DEFAULT_FEE = 100000; // 월 운동 비용(원)
export const DEFAULT_TARGET = 12; // 월 목표 횟수 (주3회 ≈ 월12회)

/** 월간 결산의 "다음 달 추천 목표" 상향 폭(회). 밸런싱 knob. */
export const NEXT_TARGET_STEP = 2;

/** 상태 저장 디바운스(ms) — 잦은 변경을 묶어 저장/동기화. */
export const SAVE_DEBOUNCE_MS = 800;
