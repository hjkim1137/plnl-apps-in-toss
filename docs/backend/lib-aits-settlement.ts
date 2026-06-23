// 월말 결산 푸시 메시지 빌더 (서버) — 클라 calc.computeMonth · brackets.isGraduated ·
// settlement.buildCertificate 의 '톤 분기'를 서버에서 자체 계산한다(푸시는 서버에서만 발송).
// 복사 위치: plnl.vercel.app/lib/aits/settlement.ts
//
// 매월 1일 cron(push/send)이 호출 → 직전 달 회수율로 결산/표창장 "도착" 메시지를 만든다.
//   100% 이상 → 호구 졸업장(축하) / 미달 → 후원 표창장 + 결산 넛지
// ⚠️ 문구는 B(선민) 콘텐츠 영역 — 여기 텍스트는 기능 placeholder. 최종 카피는 클라 content.ts 와 맞춘다.

import type { PlnlRow } from "@/lib/aits/db";
import { kstNow, monthPrefix } from "@/lib/aits/userActions";

/** 천 단위 콤마(원 표기). */
function won(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

export interface PushMessage {
  title: string;
  body: string;
  deepLink: string;
}

/**
 * 직전 달(KST) 결산 푸시 메시지. 그 달 출석이 한 번도 없으면 null(이탈 유저 스팸 방지).
 * @param now 기준 시각(KST). 보통 매월 1일 → 직전 달을 결산.
 */
export function buildLastMonthPush(
  row: PlnlRow,
  now: Date = kstNow(),
): PushMessage | null {
  // 직전 달(y, m: 0-based) — cron 이 1일에 돌면 "지난달".
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() - 1;
  if (m < 0) {
    m = 11;
    y -= 1;
  }
  const prefix = monthPrefix(y, m);

  let done = 0;
  for (const [k, v] of Object.entries(row.logs)) {
    if (k.startsWith(prefix) && v === "done") done++;
  }
  if (done < 1) return null; // 그 달 활동 없음 → 발송 안 함(튜너블)

  const fee = Math.max(0, row.fee);
  const target = Math.max(1, row.target);
  const rate = Math.round((done / target) * 1000) / 10; // 소수1자리
  const recovered = (fee / target) * done;
  const monthLabel = `${m + 1}월`;
  const deepLink = "plnl://monthly"; // 월간 현황(결산/표창장) 탭. 실제 스킴은 콘솔 설정에 맞춤.

  if (rate >= 100) {
    const over = Math.max(0, recovered - fee);
    return {
      title: "🎓 호구 졸업!",
      body: `${monthLabel} 회수율 ${rate}% 달성 — 호구 명단에서 제명됐어요${over > 0 ? `. 초과 회수 ${won(over)}!` : ""}. 졸업장이 도착했어요.`,
      deepLink,
    };
  }
  const donate = Math.max(0, fee - recovered);
  return {
    title: "🏅 표창장 도착",
    body: `${monthLabel} 회수율 ${rate}% — ${won(donate)} 기부하셨네요. 결산 리포트와 다음 달 목표를 확인해 보세요.`,
    deepLink,
  };
}
