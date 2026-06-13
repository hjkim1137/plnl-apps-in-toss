// 날짜 유틸 — 출석 기록은 'YYYY-MM-DD' 문자열 키로 저장한다.
// v1 은 디바이스 로컬 타임존 기준. (KST 고정이 필요하면 SDK getServerTime() 으로
// 보정 검토 — 해외/시차 사용자가 자정 경계에서 하루 어긋날 수 있음. TODO 검수)

export const pad = (n: number): string => String(n).padStart(2, "0");

/** Date → 'YYYY-MM-DD' */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → Date(로컬 자정). 형식이 틀리면 null. */
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'YYYY-MM' 월 키. m 은 0-based(0=1월). */
export function monthPrefix(y: number, m: number): string {
  return `${y}-${pad(m + 1)}-`;
}

/** (y, m: 0-based, d) → 'YYYY-MM-DD' 일자 키. */
export function dayKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** 그 달의 일수. m 은 0-based. */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** 그 달 1일의 요일 (0=일 … 6=토). */
export function firstWeekday(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

/** 오늘 'YYYY-MM-DD' */
export function todayStr(now: Date = new Date()): string {
  return ymd(now);
}

/** 연*12+월 인덱스 — 월 비교/이동에 사용. */
export function monthIndex(y: number, m: number): number {
  return y * 12 + m;
}
