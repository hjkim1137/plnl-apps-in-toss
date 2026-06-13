// 숫자 포맷 유틸. 화면(A)·카피(content)·로직 공용.

/** 1234567 → "1,234,567원" (반올림) */
export function won(n: number): string {
  return wonN(n) + "원";
}

/** 1234567 → "1,234,567" (반올림, 단위 없음) */
export function wonN(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

/** 소수 1자리로 반올림 (회수율 표기용). 33.333 → 33.3 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
