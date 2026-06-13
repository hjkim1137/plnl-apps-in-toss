// 회수율 구간 판정 (기획 §8). 7구간.
// 여기서는 '구간 키'만 결정한다 — 라벨/이모지/색/카피는 content.ts(콘텐츠=B, 디자인=A).
// 임계값 경계는 목업과 동일(부동소수 오차 흡수용 +0.0000001).

export type BracketKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 0: 지갑만 운동러 (출석 0)
 * 1: 후원왕 (1~25%)
 * 2: 각성 직전 (26~50%)
 * 3: 기부→운동 전환 (51~75%)
 * 4: 본전 임박 (76~99%)
 * 5: 호구 졸업 (정확히 100%)
 * 6: 이젠 내가 갑 (100% 초과)
 */
export function resolveBracketKey(rate: number, done: number): BracketKey {
  if (done <= 0) return 0;
  if (rate < 25.0000001) return 1;
  if (rate < 50.0000001) return 2;
  if (rate < 75.0000001) return 3;
  if (rate < 100) return 4;
  if (rate < 100.0000001) return 5;
  return 6;
}

/** 100% 이상 달성(호구 졸업 이상) 여부 — 표창장 종류 분기 등에 사용. */
export function isGraduated(rate: number): boolean {
  return rate >= 100;
}
