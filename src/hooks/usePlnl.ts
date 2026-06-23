// usePlnl — D(현정)가 만든 모든 로직을 화면(A/인정)에 넘기는 단일 핸드오프 훅.
//
// A 는 로직을 몰라도 됩니다:
//   const plnl = usePlnl();
//   plnl.today.rate            // 이번 달 회수율
//   plnl.today.bracket.label   // "본전 임박" 등 구간 라벨
//   plnl.actions.checkIn("done")
//   plnl.monthly.calendar      // 달력 셀 배열
//
// 상태 영속(로컬+서버 동기화), 광고 시청, 월 이동, 로그인까지 전부 이 훅이 처리한다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isAdConfigured, playAd, type AdKind } from "../lib/ads";
import {
  applyCheckIn,
  clearMonth as clearMonthLogs,
  cycleCalendarDay,
  freeCheckinsLeft,
  monthLogs,
  monthsGraduated,
  totalDone,
  unlockAfterCheckinAd,
} from "../lib/attendance";
import {
  isAuthConfigured,
  loginWithToss,
  makeMockSession,
  saveStoredSession,
  type Session,
} from "../lib/auth";
import { computeMonth, todayChoice, type MonthStats } from "../lib/calc";
import {
  captionsFor,
  MONTH_LABELS,
  monthStatusText,
  resolveBracketView,
} from "../lib/content";
import {
  CALENDAR_MIN_MONTH,
  CALENDAR_MIN_YEAR,
  SAVE_DEBOUNCE_MS,
} from "../lib/constants";
import {
  dayKey,
  daysInMonth,
  firstWeekday,
  monthIndex,
  todayStr,
} from "../lib/date";
import { applyBuyFreeze, applyFreezeFromAd, canBuyFreeze } from "../lib/freeze";
import {
  applyMilestoneClaim,
  milestoneChips,
  nextClaimableMilestone,
} from "../lib/milestones";
import { type LogValue, type PlnlState } from "../lib/model";
import {
  currentMonthIndex,
  detectArrival,
  isNotifyAvailable,
  requestNotifyAgreement,
} from "../lib/notify";
import {
  buildCertificate,
  buildReport,
  daysUntilMonthEnd,
  isMonthEnded,
} from "../lib/settlement";
import { bestStreakAll, currentStreak, maxStreakInMonth } from "../lib/streak";
import { resolveTitle } from "../lib/titles";
import {
  loadLocalState,
  loadRemoteState,
  mergeForLogin,
  saveLocalState,
  saveRemoteState,
} from "../lib/userData";

export interface CalendarCell {
  /** 빈 칸(앞 패딩)이면 day=0. */
  day: number;
  dateStr: string;
  value: LogValue | null;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * dev 환경에서 광고 그룹 미설정 시 mock 보상으로 흐름을 막지 않는다.
 * prod 에서 미설정이면 false(보상 미지급) — 호출부가 안내.
 */
async function playAdSafe(kind: AdKind): Promise<boolean> {
  if (!isAdConfigured(kind)) {
    if (import.meta.env.DEV) return true; // dev mock
    return false;
  }
  try {
    const { earned } = await playAd(kind);
    return earned;
  } catch {
    return false;
  }
}

/** 특정 달(y, m: 0-based)의 진실 숫자. 오늘/월간 탭이 공유. */
function statsForMonth(state: PlnlState, y: number, m: number): MonthStats {
  return computeMonth(state.fee, state.target, monthLogs(state.logs, y, m));
}

export function usePlnl() {
  const now = useMemo(() => new Date(), []);
  const curY = now.getFullYear();
  const curM = now.getMonth();
  const today = todayStr(now);

  const [state, setState] = useState<PlnlState>(() => loadLocalState(now));
  const [viewY, setViewY] = useState(curY);
  const [viewM, setViewM] = useState(curM);
  const [previewEnd, setPreviewEnd] = useState(false);
  // 결산/표창장은 "해당 달 1회" 광고 시청 후 열람(세션). 달이 바뀌면 리셋.
  const [adSeen, setAdSeen] = useState({ report: false, cert: false });
  // 이번 세션에 '도착'한 직전 달(월 경계를 넘어 처음 연 경우). null = 도착 없음.
  const [arrival, setArrival] = useState<{ y: number; m: number } | null>(null);

  // 비동기 액션이 항상 최신 state 를 보도록 ref 동기화.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── 영속: 상태 변경 시 디바운스 저장(로컬 + 로그인 시 서버) ──────────────
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    saveLocalState(state);
    if (!state.loggedIn || !sessionRef.current) return;
    const key = sessionRef.current.userKey;
    const t = setTimeout(() => {
      saveRemoteState(key, stateRef.current).catch((e) =>
        console.warn("[usePlnl] 서버 저장 실패", e),
      );
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state]);

  // ── 월말 도착 트리거 (F17) ─────────────────────────────────────────────
  // 마운트 시: 서버 시각(KST) 기준 현재 달과 마지막 방문 달을 비교해, 달이 넘어갔으면 직전
  // 달의 결산/표창장이 "도착"했음을 감지하고 lastSeenMonth 를 갱신한다. (생성/공개 로직은
  // settlement.ts, 실제 푸시 발송은 서버 스마트 발송)
  //
  // now 가 안정값이라 사실상 1회 실행. StrictMode 의 mount→cleanup→remount 이중 호출에는
  // cancelled 플래그로 stale write 만 막고, 재실행은 멱등(detectArrival 순수 + 같은 결과)하게
  // 둔다 — ref 가드로 막으면 첫 실행이 취소된 뒤 재실행이 안 돌아 트리거가 통째로 누락된다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idx = await currentMonthIndex(now);
      if (cancelled) return;
      const seen = stateRef.current.lastSeenMonth;
      const arr = detectArrival(seen, idx);
      if (arr) setArrival(arr);
      if (seen !== idx) setState((s) => ({ ...s, lastSeenMonth: idx }));
    })();
    return () => {
      cancelled = true;
    };
  }, [now]);

  // ── 파생값: 오늘 탭 ────────────────────────────────────────────────────
  const todayData = useMemo(() => {
    const stats = statsForMonth(state, curY, curM);
    const bracket = resolveBracketView(stats.rate, stats.done);
    const caps = captionsFor(bracket.key, stats);
    return {
      stats,
      bracket,
      headline: caps[0],
      captions: caps.slice(1),
      monthStatus: monthStatusText(stats),
      choice: todayChoice(stats),
      monthLabel: MONTH_LABELS[curM],
      /** 오늘 이미 체크한 값(없으면 null). */
      todayValue: state.logs[today] ?? null,
    };
  }, [state.fee, state.target, state.logs, curY, curM, today]);

  // ── 파생값: 출석 체크 UI 분기 ──────────────────────────────────────────
  const checkin = useMemo(() => {
    const left = freeCheckinsLeft(state);
    const alreadyToday = state.logs[today] != null;
    const mode: "buttons" | "ad-gate" =
      state.loggedIn || alreadyToday || left > 0 || state.adUnlocked
        ? "buttons"
        : "ad-gate";
    return { mode, freeLeft: left, freeLimitReached: !state.loggedIn && left === 0 };
  }, [state, today]);

  // ── 파생값: 월간 탭 ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const stats = statsForMonth(state, viewY, viewM);
    const bracket = resolveBracketView(stats.rate, stats.done);
    const ended = isMonthEnded(viewY, viewM, now, previewEnd);

    // 달력 셀
    const cells: CalendarCell[] = [];
    const lead = firstWeekday(viewY, viewM);
    for (let i = 0; i < lead; i++) {
      cells.push({ day: 0, dateStr: "", value: null, isToday: false, isFuture: false });
    }
    const days = daysInMonth(viewY, viewM);
    for (let d = 1; d <= days; d++) {
      const ds = dayKey(viewY, viewM, d);
      cells.push({
        day: d,
        dateStr: ds,
        value: state.logs[ds] ?? null,
        isToday: ds === today,
        isFuture: ds > today,
      });
    }

    const report = buildReport(stats, viewY, viewM, maxStreakInMonth(state.logs, viewY, viewM));
    const certificate = buildCertificate(stats, viewY, viewM);

    return {
      stats,
      bracket,
      year: viewY,
      month: viewM,
      monthLabel: MONTH_LABELS[viewM],
      isCurrent: viewY === curY && viewM === curM,
      monthEnded: ended,
      daysLeft: daysUntilMonthEnd(viewY, viewM, now),
      calendar: cells,
      report,
      certificate,
      showNotif: state.loggedIn && ended,
    };
    // adSeen 은 의도적으로 의존성에서 제외 — 두 boolean(열람 여부)만 좌우하므로 무거운
    // 달력/결산/표창장 재계산을 일으키지 않도록 메모 밖(return)에서 합성한다.
  }, [state.fee, state.target, state.logs, state.loggedIn, viewY, viewM, previewEnd, now, curY, curM, today]);

  // ── 파생값: 게이미피케이션(로그인) ─────────────────────────────────────
  const gamification = useMemo(() => {
    const td = totalDone(state.logs);
    const streak = currentStreak(state.logs, now);
    return {
      title: resolveTitle(td),
      totalDone: td,
      monthsGraduated: monthsGraduated(state.logs, state.target),
      streak,
      bestStreak: bestStreakAll(state.logs),
      milestoneChips: milestoneChips(streak, state.claimed),
      claimableMilestone: nextClaimableMilestone(streak, state.claimed),
      points: state.points,
      freezes: state.freezes,
      canBuyFreeze: canBuyFreeze(state),
    };
  }, [state.logs, state.target, state.claimed, state.points, state.freezes, now]);

  // ── 액션 ───────────────────────────────────────────────────────────────

  /** 오늘의 선택(출석 체크). 무료/광고 소진 시 자동으로 전면형 광고 → 언락 → 재시도. */
  const checkIn = useCallback(
    async (value: LogValue) => {
      const r = applyCheckIn(stateRef.current, today, value);
      if (r.ok) {
        setState(r.next);
        return { ok: true as const };
      }
      // need_ad
      const earned = await playAdSafe("interstitial");
      if (!earned) return { ok: false as const, reason: "ad_incomplete" as const };
      const unlocked = unlockAfterCheckinAd(stateRef.current);
      const r2 = applyCheckIn(unlocked, today, value);
      if (r2.ok) setState(r2.next);
      return { ok: r2.ok };
    },
    [today],
  );

  /** 무료 소진 후 출석용 전면형 광고만 시청 → 1회 언락(이후 go/skip 선택 가능). */
  const watchCheckinAd = useCallback(async () => {
    const earned = await playAdSafe("interstitial");
    if (!earned) return { ok: false as const, reason: "ad_incomplete" as const };
    setState(unlockAfterCheckinAd(stateRef.current));
    return { ok: true as const };
  }, []);

  /** 달력 날짜 직접 토글(과거 보정). */
  const cycleDay = useCallback((dateStr: string) => {
    setState(cycleCalendarDay(stateRef.current, dateStr));
  }, []);

  const clearMonth = useCallback((y: number, m: number) => {
    setState(clearMonthLogs(stateRef.current, y, m));
  }, []);

  const setSettings = useCallback(
    (next: { fee?: number; target?: number }) => {
      setState((s) => ({
        ...s,
        fee: next.fee != null ? Math.max(0, next.fee) : s.fee,
        target: next.target != null ? Math.max(1, next.target) : s.target,
      }));
    },
    [],
  );

  /** 스트릭 마일스톤 수령 — 전면형 광고 보고 포인트. */
  const claimMilestone = useCallback(async () => {
    const m = nextClaimableMilestone(
      currentStreak(stateRef.current.logs, now),
      stateRef.current.claimed,
    );
    if (!m) return { ok: false as const, reason: "none" as const };
    const earned = await playAdSafe("interstitial");
    if (!earned) return { ok: false as const, reason: "ad_incomplete" as const };
    setState(applyMilestoneClaim(stateRef.current, m));
    return { ok: true as const, milestone: m };
  }, [now]);

  /** 보호권 포인트로 구매. */
  const buyFreeze = useCallback(() => {
    const next = applyBuyFreeze(stateRef.current);
    if (!next) return { ok: false as const, reason: "insufficient" as const };
    setState(next);
    return { ok: true as const };
  }, []);

  /** 보호권 보상형 광고(30초)로 획득. */
  const watchFreezeAd = useCallback(async () => {
    const earned = await playAdSafe("rewarded");
    if (!earned) return { ok: false as const, reason: "ad_incomplete" as const };
    setState(applyFreezeFromAd(stateRef.current));
    return { ok: true as const };
  }, []);

  /** 월간 결산 열람용 전면형 광고. */
  const watchReportAd = useCallback(async () => {
    const earned = await playAdSafe("interstitial");
    if (earned) setAdSeen((a) => ({ ...a, report: true }));
    return { ok: earned };
  }, []);

  /** 표창장 열람용 전면형 광고. */
  const watchCertAd = useCallback(async () => {
    const earned = await playAdSafe("interstitial");
    if (earned) setAdSeen((a) => ({ ...a, cert: true }));
    return { ok: earned };
  }, []);

  // ── 월 이동 ────────────────────────────────────────────────────────────
  const goToMonth = useCallback(
    (y: number, m: number) => {
      const min = monthIndex(CALENDAR_MIN_YEAR, CALENDAR_MIN_MONTH);
      const max = monthIndex(curY, curM);
      const idx = Math.max(min, Math.min(max, monthIndex(y, m)));
      const ny = Math.floor(idx / 12);
      const nm = idx % 12;
      setViewY(ny);
      setViewM(nm);
      if (!(ny === curY && nm === curM)) setPreviewEnd(false);
      setAdSeen({ report: false, cert: false }); // 달 바뀌면 광고 다시
    },
    [curY, curM],
  );

  const shiftMonth = useCallback(
    (delta: number) => {
      const idx = monthIndex(viewY, viewM) + delta;
      goToMonth(Math.floor(idx / 12), idx % 12);
    },
    [viewY, viewM, goToMonth],
  );

  /** 월말 미리보기(표창장/결산 해제) 토글 — 출시 전 데모/검증용. */
  const togglePreview = useCallback(() => {
    setPreviewEnd((p) => !p);
    setAdSeen({ report: false, cert: false });
  }, []);

  // ── 알림 (F17) ─────────────────────────────────────────────────────────

  /**
   * 알림 수신 동의 요청 → 동의 시 notifyAgreed 저장. 강제 노출 금지 — 도착/로그인 등
   * 전환 의도가 강한 순간에 화면이 CTA 로 호출한다(F6 와 같은 철학).
   */
  const enableNotifications = useCallback(async () => {
    const outcome = await requestNotifyAgreement();
    if (outcome === "agreed") setState((s) => ({ ...s, notifyAgreed: true }));
    return { ok: outcome === "agreed", outcome };
  }, []);

  /** 도착한 달의 결산/표창장으로 이동(월 뷰 전환) + 도착 배너 해제. */
  const openArrival = useCallback(() => {
    if (arrival) goToMonth(arrival.y, arrival.m);
    setArrival(null);
  }, [arrival, goToMonth]);

  /** 도착 배너 닫기. */
  const dismissArrival = useCallback(() => setArrival(null), []);

  // 알림/월말 도착(F17). arrival = 이번 세션에 도착한 직전 달(없으면 null).
  // canPrompt = 동의 CTA 노출 여부(미동의 + 사용 가능 환경). 파생값이라 메모(파일 컨벤션).
  const notif = useMemo(
    () => ({
      arrival: arrival
        ? { ...arrival, monthLabel: MONTH_LABELS[arrival.m] }
        : null,
      canPrompt: isNotifyAvailable() && !state.notifyAgreed,
    }),
    [arrival, state.notifyAgreed],
  );

  /** 선택 가능한 월 목록(드롭다운용). 2026.01~현재. */
  const selectableMonths = useMemo(() => {
    const out: { y: number; m: number; label: string }[] = [];
    for (let y = CALENDAR_MIN_YEAR; y <= curY; y++) {
      const mStart = y === CALENDAR_MIN_YEAR ? CALENDAR_MIN_MONTH : 0;
      const mEnd = y === curY ? curM : 11;
      for (let m = mStart; m <= mEnd; m++) {
        out.push({ y, m, label: `${y}년 ${MONTH_LABELS[m]}` });
      }
    }
    return out;
  }, [curY, curM]);

  // ── 로그인 ─────────────────────────────────────────────────────────────
  const login = useCallback(async () => {
    let session: Session;
    try {
      session = isAuthConfigured() ? await loginWithToss() : makeMockSession();
    } catch (e) {
      console.warn("[usePlnl] 로그인 실패", e);
      return { ok: false as const };
    }
    saveStoredSession(session);
    sessionRef.current = session;
    try {
      const remote = await loadRemoteState(session.userKey, now);
      const merged = mergeForLogin(stateRef.current, remote);
      setState(merged);
      // 병합 결과 즉시 서버 반영(기기 간 보존).
      saveRemoteState(session.userKey, merged).catch(() => {});
    } catch (e) {
      console.warn("[usePlnl] 원격 로드 실패 — 로컬 유지", e);
      setState((s) => ({ ...s, loggedIn: true }));
    }
    return { ok: true as const };
  }, [now]);

  return {
    state,
    today: todayData,
    checkin,
    // 광고 열람 여부(adSeen)는 가벼운 합성 — monthlyData 메모를 재계산시키지 않음.
    monthly: {
      ...monthlyData,
      reportUnlocked: adSeen.report,
      certUnlocked: adSeen.cert,
    },
    game: gamification,
    selectableMonths,
    view: { year: viewY, month: viewM, previewEnd },
    notif,
    actions: {
      checkIn,
      watchCheckinAd,
      cycleDay,
      clearMonth,
      setSettings,
      claimMilestone,
      buyFreeze,
      watchFreezeAd,
      watchReportAd,
      watchCertAd,
      goToMonth,
      shiftMonth,
      togglePreview,
      enableNotifications,
      openArrival,
      dismissArrival,
      login,
    },
  };
}

export type PlnlController = ReturnType<typeof usePlnl>;
