// 월말 트리거 · 알림 (기획 §8 / F17 / 업무분장 D). 두 가지 책임:
//   1) 월 경계 감지(순수) — 앱을 '직전 달이 끝난 뒤' 다시 열면 그 달의 결산/표창장이
//      "도착"했다고 판정한다. (생성 로직은 settlement.ts, 공개 시점만 여기서 트리거)
//   2) 알림 동의 — 앱인토스 requestNotificationAgreement 래핑. 동의만 클라가 받고,
//      실제 매일/도착 푸시 발송은 서버 '스마트 발송'이 담당(docs/backend·세그먼트 TODO).
//
// SDK 미설정/토스 앱 밖에선 흐름을 막지 않도록 ads.ts·auth.ts 와 같은 dev-mock 패턴을 쓴다.

import {
  getServerTime,
  requestNotificationAgreement,
} from "@apps-in-toss/web-framework";

import { kstYearMonth, monthIndex } from "./date";

// ── 월 경계(순수) ─────────────────────────────────────────────────────────

/** getServerTime 응답 대기 상한(ms). 토스 앱 밖/브리지 지연 시 무한 대기를 막고 로컬 폴백. */
const SERVER_TIME_TIMEOUT_MS = 1200;

/**
 * 지금이 몇 번째 달(monthIndex)인지. getServerTime() 으로 KST 월 경계를 고정하고,
 * 실패/지연/미응답 시 기기 로컬 시각으로 폴백한다. (date.ts 의 KST 보정 TODO 와 정합 —
 * 월 경계는 가장 시차에 민감한 지점이라 서버 시각을 우선한다.)
 *
 * 토스 앱 밖에선 브리지 호출(getServerTime)이 영영 resolve 되지 않을 수 있어 타임아웃과
 * 레이스한다 — 안 그러면 월말 도착 트리거가 통째로 멈춤. (auth.fetchAnonymousKey 와 동일 철학)
 */
export async function currentMonthIndex(fallback: Date): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ms = await Promise.race([
      Promise.resolve(getServerTime()),
      new Promise<undefined>((res) => {
        timer = setTimeout(() => res(undefined), SERVER_TIME_TIMEOUT_MS);
      }),
    ]);
    if (typeof ms === "number" && Number.isFinite(ms)) {
      const { y, m } = kstYearMonth(ms);
      return monthIndex(y, m);
    }
  } catch {
    // 토스 앱 밖/구버전 — 로컬 폴백
  } finally {
    clearTimeout(timer); // 레이스에서 진 타이머 정리(closure 잔존 방지)
  }
  return monthIndex(fallback.getFullYear(), fallback.getMonth());
}

/**
 * 마지막으로 앱을 연 달(lastSeen) 이후로 달이 넘어갔으면, 방금 끝난 가장 최근 달을 반환.
 * 그 달의 결산/표창장이 "도착"한 것 — 화면이 도착 배너/이동에 사용한다. 순수 함수.
 *   - lastSeen=0(미설정): 첫 방문 → 도착 없음(false trigger 방지)
 *   - currentIdx<=lastSeen: 같은 달 재방문/시계 역행 → 없음
 */
export function detectArrival(
  lastSeen: number,
  currentIdx: number,
): { y: number; m: number } | null {
  if (lastSeen <= 0) return null;
  if (currentIdx <= lastSeen) return null;
  const ended = currentIdx - 1; // 직전(방금 끝난) 달
  return { y: Math.floor(ended / 12), m: ended % 12 };
}

// ── 알림 동의 (앱인토스) ──────────────────────────────────────────────────

/** 동의 요청용 알림 템플릿 코드(앱인토스 콘솔에서 발급). 미설정이면 동의 흐름 비활성. */
const NOTIFY_TEMPLATE_CODE = import.meta.env.VITE_NOTIFY_TEMPLATE_CODE ?? "";

export function isNotifyConfigured(): boolean {
  return NOTIFY_TEMPLATE_CODE.length > 0;
}

/** 동의 흐름을 노출/실행할 수 있는가(실제 설정 또는 dev mock). dev-mock 정책의 단일 출처. */
export function isNotifyAvailable(): boolean {
  return isNotifyConfigured() || import.meta.env.DEV;
}

/** agreed = newAgreement|alreadyAgreed, rejected = 거절, unavailable = 미설정/SDK 불가. */
export type NotifyOutcome = "agreed" | "rejected" | "unavailable";

/**
 * 알림 수신 동의 다이얼로그 → 결과. 콜백 기반 SDK 를 Promise 로 래핑하고 cleanup 수행.
 * dev/미설정에선 mock("agreed") 으로 흐름 검증 가능(실제 동의 X). prod 미설정이면 unavailable.
 */
export async function requestNotifyAgreement(): Promise<NotifyOutcome> {
  if (!isNotifyConfigured()) {
    return import.meta.env.DEV ? "agreed" : "unavailable";
  }
  return new Promise<NotifyOutcome>((resolve) => {
    let settled = false;
    let unregister: (() => void) | undefined;
    const done = (o: NotifyOutcome) => {
      if (settled) return;
      settled = true;
      unregister?.();
      resolve(o);
    };
    try {
      unregister = requestNotificationAgreement({
        options: { templateCode: NOTIFY_TEMPLATE_CODE },
        onEvent: ({ type }) =>
          done(type === "agreementRejected" ? "rejected" : "agreed"),
        onError: () => done("unavailable"),
      });
    } catch {
      done("unavailable");
    }
  });
}
