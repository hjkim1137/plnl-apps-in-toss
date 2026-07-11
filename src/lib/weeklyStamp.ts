// 주간 목표 도장판 계산 — MonthlyScreen 의 WeeklyStampBoard 와 qa_verify 가 공유.

export interface StampCell {
  day: number;
  value: string | null;
}

export interface WeekStamp {
  done: number;
  earned: boolean;
}

export interface WeeklyStampResult {
  weeklyGoal: number;
  weeks: WeekStamp[];
}

/**
 * 달력 셀 배열을 7개씩 묶어 주차별 도장 달성 여부를 반환.
 * - weeklyGoal = ceil(monthlyTarget / 주차수)
 * - done(출석) 수 >= weeklyGoal 이면 earned=true
 * - 빈 칸(day=0) 은 집계에서 제외
 */
export function weeklyStampData(cells: StampCell[], monthlyTarget: number): WeeklyStampResult {
  const rows: StampCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    if (row.some((c) => c.day > 0)) rows.push(row);
  }
  // monthlyTarget=0(스냅샷 없는 빈 달)이면 0/0=NaN이 되므로 최소 1 보장.
  const weeklyGoal = Math.max(1, Math.ceil(monthlyTarget / Math.max(1, rows.length)));
  return {
    weeklyGoal,
    weeks: rows.map((row) => {
      const realDays = row.filter((c) => c.day > 0);
      const done = realDays.filter((c) => c.value === "done").length;
      return { done, earned: done >= weeklyGoal };
    }),
  };
}
