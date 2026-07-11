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

import { playAdSafe } from "../lib/ads";
import {
  applyCheckIn,
  clearMonth as clearMonthLogs,
  cycleCalendarDay,
  monthLogs,
  monthsGraduated,
} from "../lib/attendance";
import {
  getStoredSession,
  loginOrMock,
  saveStoredSession,
  type Session,
} from "../lib/auth";
import { computeMonth, EMPTY_MONTH_STATS, todayChoice, type MonthStats } from "../lib/calc";
import {
  headlineFor,
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
  monthKey,
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
import { buildCertificate, buildReport } from "../lib/settlement";
import {
  applyFreezeRepair,
  bestStreakAll,
  declineFreezeRepair,
  detectFreezeRepair,
  detectStreakStatusPopup,
  livingStreak,
  maxStreakInMonth,
  type FreezeRepair,
  type StreakStatusPopup,
} from "../lib/streak";
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
  /** 보호권으로 보호된 날(빠졌지만 스트릭이 끊기지 않게 메운 날). */
  isFrozen: boolean;
}

/**
 * 특정 달(y, m: 0-based)의 진실 숫자. 오늘/월간 탭이 공유.
 * 그 달 설정은 월별 스냅샷(monthSettings)을 쓰고 없으면 현재 fee/target 으로 폴백한다.
 * 스냅샷도 로그도 없는 과거 달은 0원·0회(EMPTY)로 처리해, 안 쓴 달에 낸 돈/기부액이 뜨지 않게 한다.
 */
function statsForMonth(
  state: PlnlState,
  y: number,
  m: number,
  curY: number,
  curM: number,
): MonthStats {
  const ml = monthLogs(state.logs, y, m);
  const isCurrent = y === curY && m === curM;
  const snap = state.monthSettings[monthKey(y, m)];
  // 과거 달은 '그 달에 저장된 스냅샷'으로만 계산한다. 스냅샷이 없으면(설정 이력이 없는 달)
  // 현재 fee/target 이 과거 달로 유입되지 않도록 빈 통계로 표기한다 — 현재 설정 폴백 금지.
  // (현재 달은 진입 시 ensure 이펙트가 스냅샷을 보장하므로, 앞으로 과거 달엔 항상 자기 스냅샷이 있다.)
  if (!isCurrent) {
    return snap ? computeMonth(snap.fee, snap.target, ml) : EMPTY_MONTH_STATS;
  }
  const { fee, target } = snap ?? { fee: state.fee, target: state.target };
  return computeMonth(fee, target, ml);
}

export function usePlnl() {
  const now = useMemo(() => new Date(), []);
  const curY = now.getFullYear();
  const curM = now.getMonth();
  const today = todayStr(now);

  const [state, setState] = useState<PlnlState>(() => loadLocalState(now));
  const [viewY, setViewY] = useState(curY);
  const [viewM, setViewM] = useState(curM);
  // 결산/표창장 광고 열람은 이제 state.reportSeen/certSeen(본 '달' 목록)로 영속 —
  // 재로그인·달이동해도 유지. (기존 ephemeral adSeen 제거)
  // 이번 세션에 '도착'한 직전 달(월 경계를 넘어 처음 연 경우). null = 도착 없음.
  const [arrival, setArrival] = useState<{ y: number; m: number } | null>(null);
  // 보호권으로 메울 수 있는 빠진 날 제안(확인 후 복구). null = 제안 없음. 영속 아님(세션 UI).
  const [freezeRepair, setFreezeRepair] = useState<FreezeRepair | null>(null);
  // 스트릭 상태 팝업(유지 축하/끊김 위로). null = 없음. 영속 아님(세션 UI, 노출 마커만 영속).
  const [streakPopup, setStreakPopup] = useState<StreakStatusPopup | null>(null);

  // 비동기 액션이 항상 최신 state 를 보도록 ref 동기화.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── 영속: 상태 변경 시 디바운스 저장(로컬 + 로그인 시 서버) ──────────────
  const sessionRef = useRef<Session | null>(null);
  // 앱 재시작(이미 로그인 상태로 localStorage 복원) 시 저장된 세션을 ref 에 복원한다.
  // login() 은 새 로그인 때만 호출되므로 이게 없으면 재진입 후 자동 원격저장이 sessionRef=null
  // 가드에 막혀 통째로 스킵된다 → 로컬에만 쌓이고 Supabase 미반영(부분 저장 버그). 마운트 1회.
  useEffect(() => {
    if (!sessionRef.current) sessionRef.current = getStoredSession();
  }, []);

  // 현재 달 설정 스냅샷 보장 — 없으면 현재 fee/target 으로 기록해 둔다. 달이 바뀌어 과거 달이
  // 됐을 때 그 달 값으로 동결되도록(이후 fee/target 변경에 영향받지 않게). 마운트/월 변경 시 1회.
  useEffect(() => {
    const ym = monthKey(curY, curM);
    setState((s) =>
      s.monthSettings[ym]
        ? s
        : { ...s, monthSettings: { ...s.monthSettings, [ym]: { fee: s.fee, target: s.target } } },
    );
  }, [curY, curM]);

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

  // ── 보호권 복구 제안 감지 (확인 후 복구) ──────────────────────────────────
  // 마운트 시 1회: 빠진 빈 날을 보유 보호권으로 메울 수 있으면 '제안'만 띄운다(차감은 동의 후).
  // 순수 read 라 영속 상태는 건드리지 않고 UI 상태(freezeRepair)에만 보관. 로그인 직후엔
  // login() 이 머지 결과로 다시 감지한다(서버 기록의 빈 날 포함).
  useEffect(() => {
    setFreezeRepair(detectFreezeRepair(stateRef.current, now));
  }, [now]);

  // ── 스트릭 상태 팝업 감지 (진입 시 1회) ────────────────────────────────────
  // 유지 축하 / 끊김 위로 팝업. 순수 read — 노출 마커는 dismiss 시 기록. 복구/로그인 액션이
  // state 를 바꾼 뒤엔 각 핸들러에서 재감지한다(freezeRepair 와 동일한 lockstep 패턴).
  useEffect(() => {
    setStreakPopup(detectStreakStatusPopup(stateRef.current, now));
  }, [now]);

  // ── 파생값: 오늘 탭 ────────────────────────────────────────────────────
  const todayData = useMemo(() => {
    const stats = statsForMonth(state, curY, curM, curY, curM);
    const bracket = resolveBracketView(stats.rate, stats.done);
    // 헤드라인 앞 인사: 로그인 + 이름이 있으면 "OOO 회원님,", 그 외(비로그인/이름 없음)는 "회원님,".
    const name = state.loggedIn ? sessionRef.current?.profile?.name ?? null : null;
    const greeting = name ? `${name} 회원님, ` : "회원님, ";
    return {
      stats,
      bracket,
      headline: greeting + headlineFor(bracket.key, stats),
      monthStatus: monthStatusText(stats),
      choice: todayChoice(stats),
      monthLabel: MONTH_LABELS[curM],
      /** 오늘 이미 체크한 값(없으면 null). */
      todayValue: state.logs[today] ?? null,
    };
  }, [state.fee, state.target, state.monthSettings, state.logs, state.loggedIn, curY, curM, today]);

  // ── 파생값: 월간 탭 ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const stats = statsForMonth(state, viewY, viewM, curY, curM);
    const bracket = resolveBracketView(stats.rate, stats.done);
    // 결산·표창장 모두 달 무관 광고로 미리 열람(reportUnlocked/certUnlocked) — 월말 게이트 없음.
    const isCurrent = viewY === curY && viewM === curM;

    // 달력 셀
    const cells: CalendarCell[] = [];
    const frozenSet = new Set(state.frozen);
    const lead = firstWeekday(viewY, viewM);
    for (let i = 0; i < lead; i++) {
      cells.push({ day: 0, dateStr: "", value: null, isToday: false, isFuture: false, isFrozen: false });
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
        isFrozen: frozenSet.has(ds),
      });
    }

    const report = buildReport(stats, viewY, viewM, maxStreakInMonth(state.checkins, viewY, viewM));
    const certificate = buildCertificate(stats, viewY, viewM);

    return {
      stats,
      bracket,
      year: viewY,
      month: viewM,
      monthLabel: MONTH_LABELS[viewM],
      isCurrent,
      calendar: cells,
      report,
      certificate,
    };
    // adSeen 은 의도적으로 의존성에서 제외 — 두 boolean(열람 여부)만 좌우하므로 무거운
    // 달력/결산/표창장 재계산을 일으키지 않도록 메모 밖(return)에서 합성한다.
  }, [state.fee, state.target, state.monthSettings, state.logs, state.checkins, state.loggedIn, state.frozen, viewY, viewM, now, curY, curM, today]);

  // ── 파생값: 게이미피케이션(로그인) ─────────────────────────────────────
  const gamification = useMemo(() => {
    // 누적 인증(등급)·스트릭 모두 오늘탭 출석(checkins)만으로 센다 — 월간현황 달력 수동보정
    // (logs)은 회수율·본전졸업 통계에만 반영되고 등급/스트릭엔 포함하지 않는다.
    const td = state.checkins.length;
    const streak = livingStreak(state.checkins, state.frozen, now);
    return {
      title: resolveTitle(td),
      totalDone: td,
      monthsGraduated: monthsGraduated(state.logs, state.target),
      streak,
      bestStreak: bestStreakAll(state.checkins, state.frozen),
      milestoneChips: milestoneChips(streak, state.claimed),
      claimableMilestone: nextClaimableMilestone(streak, state.claimed),
      points: state.points,
      freezes: state.freezes,
      canBuyFreeze: canBuyFreeze(state),
    };
  }, [state.logs, state.checkins, state.target, state.claimed, state.points, state.freezes, state.frozen, now]);

  // ── 액션 ───────────────────────────────────────────────────────────────

  /** 오늘의 선택(출석 체크) — 무제한·무게이트 토글. 로그인 유저는 done 진입/이탈에 ±1P. */
  const checkIn = useCallback(
    (value: LogValue) => {
      const next = applyCheckIn(stateRef.current, today, value);
      setState(next);
      // 오늘 체크로 마일스톤(3·7·14·30일)을 달성하는 순간 보상 팝업을 즉시 띄운다(진입 대기 없이).
      setStreakPopup(detectStreakStatusPopup(next, now));
      return { ok: true as const };
    },
    [today, now],
  );

  /** 달력 날짜 직접 토글. 입력은 현재 달만 — 과거 달은 조회 전용(UI 비활성 + 방어 가드). */
  const cycleDay = useCallback(
    (dateStr: string) => {
      if (dateStr.slice(0, 7) !== monthKey(curY, curM)) return;
      setState((s) => cycleCalendarDay(s, dateStr));
    },
    [curY, curM],
  );

  const clearMonth = useCallback((y: number, m: number) => {
    setState((s) => clearMonthLogs(s, y, m));
  }, []);

  const setSettings = useCallback(
    (next: { fee?: number; target?: number }) => {
      // 편집은 현재 달만 — fee/target(현재 기본값)과 현재 달 스냅샷을 함께 갱신한다. 과거 달은
      // 자기 스냅샷으로 동결돼 영향받지 않는다.
      setState((s) => {
        const fee = next.fee != null ? Math.max(0, next.fee) : s.fee;
        const target = next.target != null ? Math.max(1, next.target) : s.target;
        return {
          ...s,
          fee,
          target,
          monthSettings: { ...s.monthSettings, [monthKey(curY, curM)]: { fee, target } },
        };
      });
    },
    [curY, curM],
  );

  /** 스트릭 마일스톤 수령 — 전면형 광고 보고 포인트. */
  const claimMilestone = useCallback(async () => {
    const m = nextClaimableMilestone(
      livingStreak(stateRef.current.checkins, stateRef.current.frozen, now),
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

  /** 복구 제안 동의 — 빈 날을 보호권으로 메우고(차감) 연속을 살린다. 부활한 스트릭으로 축하 팝업 재감지. */
  const confirmFreezeRepair = useCallback(() => {
    if (!freezeRepair) return { ok: false as const };
    const next = applyFreezeRepair(stateRef.current, freezeRepair.days);
    setState(next);
    setFreezeRepair(null);
    setStreakPopup(detectStreakStatusPopup(next, now)); // 동의 → 살아난 연속으로 축하 팝업
    return { ok: true as const, days: freezeRepair.days.length };
  }, [freezeRepair, now]);

  /** 복구 제안 거절 — 빈 날을 'missed'(안 감)로 기록(보호권 안 씀). 다시 묻지 않는다. 끊김 위로 팝업으로 연결. */
  const dismissFreezeRepair = useCallback(() => {
    if (!freezeRepair) return;
    const next = declineFreezeRepair(stateRef.current, freezeRepair.days);
    setState(next);
    setFreezeRepair(null);
    setStreakPopup(detectStreakStatusPopup(next, now)); // 거절(끊김 수용) → 위로/재시작 팝업
  }, [freezeRepair, now]);

  /** 스트릭 팝업 닫기 — 노출 마커 기록(마일스톤당 1회/끊김당 1회 재노출 방지). */
  const dismissStreakPopup = useCallback(() => {
    const p = streakPopup;
    if (!p) return;
    setStreakPopup(null);
    if (p.kind === "milestone") {
      setState((s) =>
        s.streakMilestoneSeen.includes(p.milestone)
          ? s
          : { ...s, streakMilestoneSeen: [...s.streakMilestoneSeen, p.milestone] },
      );
    } else {
      setState((s) => ({ ...s, streakBrokenSeenOn: p.anchor }));
    }
  }, [streakPopup]);

  /** 월간 결산 열람용 전면형 광고. */
  // 현재 보는 달을 광고-열람 목록(reportSeen/certSeen)에 추가 — 중복 방지·정렬. 영속(자동 저장).
  const addSeenMonth = useCallback(
    (key: "reportSeen" | "certSeen") => {
      const ym = monthKey(viewY, viewM);
      setState((s) => (s[key].includes(ym) ? s : { ...s, [key]: [...s[key], ym].sort() }));
    },
    [viewY, viewM],
  );

  const watchReportAd = useCallback(async () => {
    const earned = await playAdSafe("interstitial");
    if (earned) addSeenMonth("reportSeen");
    return { ok: earned };
  }, [addSeenMonth]);

  /** 표창장 열람용 전면형 광고. */
  const watchCertAd = useCallback(async () => {
    const earned = await playAdSafe("interstitial");
    if (earned) addSeenMonth("certSeen");
    return { ok: earned };
  }, [addSeenMonth]);

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
      // 광고 열람은 달별 영속(reportSeen/certSeen)이라 달 이동 시 리셋 불필요.
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
      session = await loginOrMock();
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
      // 서버 기록의 빈 날까지 포함해 복구 제안·스트릭 팝업 재감지(로그인 직후 지연 없이).
      setFreezeRepair(detectFreezeRepair(merged, now));
      setStreakPopup(detectStreakStatusPopup(merged, now));
      // 병합 결과 즉시 서버 반영(기기 간 보존).
      saveRemoteState(session.userKey, merged).catch(() => {});
    } catch (e) {
      console.warn("[usePlnl] 원격 로드 실패 — 로컬 유지", e);
      setState((s) => ({ ...s, loggedIn: true }));
    }
    return { ok: true as const };
  }, [now]);

  // 현재 보는 달의 'YYYY-MM' 키 — 광고 열람(reportSeen/certSeen) 합성에 재사용.
  const viewMonthKey = monthKey(viewY, viewM);

  return {
    state,
    today: todayData,
    // 광고 열람 여부는 영속 reportSeen/certSeen(본 '달' 목록)에서 현재 보는 달로 합성 —
    // 재로그인·달이동해도 유지. monthlyData 메모는 재계산시키지 않음(가벼운 합성).
    monthly: {
      ...monthlyData,
      reportUnlocked: state.reportSeen.includes(viewMonthKey),
      certUnlocked: state.certSeen.includes(viewMonthKey),
    },
    game: gamification,
    selectableMonths,
    view: { year: viewY, month: viewM },
    notif,
    // 보호권 복구 제안(확인 후 복구). null = 제안 없음. count = 메울 빈 날 수 = 소비될 보호권 수.
    repair: freezeRepair ? { count: freezeRepair.days.length } : null,
    // 스트릭 상태 팝업(유지 축하/끊김 위로). null = 없음. StreakPopup 이 소비.
    streakPopup,
    actions: {
      checkIn,
      cycleDay,
      clearMonth,
      setSettings,
      claimMilestone,
      buyFreeze,
      watchFreezeAd,
      confirmFreezeRepair,
      dismissFreezeRepair,
      dismissStreakPopup,
      watchReportAd,
      watchCertAd,
      goToMonth,
      shiftMonth,
      enableNotifications,
      openArrival,
      dismissArrival,
      login,
    },
  };
}

export type PlnlController = ReturnType<typeof usePlnl>;
