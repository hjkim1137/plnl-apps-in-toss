// QA 로직 검증 스크립트 — 순수 함수 전수 테스트
// 실행: npx tsx scripts/qa_verify.ts

import { computeMonth } from "../src/lib/calc";
import { resolveBracketKey, isGraduated } from "../src/lib/brackets";
import {
  BRACKET_VISUALS,
  LEVELS,
  headlineFor,
  certificateText,
  reportGrade,
  todayCheckInStatusText,
} from "../src/lib/content";
import { resolveTitle } from "../src/lib/titles";
import {
  applyCheckIn,
  totalDone,
  monthsGraduated,
  cycleCalendarDay,
} from "../src/lib/attendance";
import { applyBuyFreeze, applyFreezeFromAd, canBuyFreeze } from "../src/lib/freeze";
import {
  currentStreak,
  livingStreak,
  bestStreakAll,
  detectFreezeRepair,
  detectStreakStatusPopup,
  applyFreezeRepair,
  declineFreezeRepair,
} from "../src/lib/streak";
import {
  normalizeState,
  sanitizeLogs,
  sanitizeDateList,
  sanitizeMonthSettings,
  createInitialState,
  type PlnlState,
} from "../src/lib/model";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof expected === "number" && typeof actual === "number"
      ? Math.abs(actual - expected) < 0.0001
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ ${label}\n     예상: ${JSON.stringify(expected)}\n     실제: ${JSON.stringify(actual)}`;
    console.log(msg);
    failures.push(msg);
  }
}

function section(name: string) {
  console.log(`\n${"─".repeat(55)}\n${name}`);
}

// ────────────────────────────────────────────────────────
section("A. 계산 엔진 (calc.ts)");

const base = computeMonth(100000, 10, {});
check("A-1 출석 0회 rate=0%", base.rate, 0);
check("A-1 단가=10,000", base.unit, 10000);
check("A-1 기부액=100,000", base.donate, 100000);
check("A-1 초과=0", base.over, 0);

const s7 = computeMonth(100000, 10, {
  "2026-06-01": "done", "2026-06-02": "done", "2026-06-03": "done",
  "2026-06-04": "done", "2026-06-05": "done", "2026-06-06": "done",
  "2026-06-07": "done",
});
check("A-2 done=7 rate=70%", s7.rate, 70);
check("A-2 회수=70,000", s7.recovered, 70000);
check("A-2 기부=30,000", s7.donate, 30000);
check("A-2 remain=3", s7.remain, 3);

const s10 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
check("A-3 done=10 rate=100%", s10.rate, 100);
check("A-3 over=0", s10.over, 0);
check("A-3 donate=0", s10.donate, 0);

const s12 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
check("A-4 done=12 rate=120%", s12.rate, 120);
check("A-4 초과=20,000", s12.over, 20000);
check("A-4 donate=0", s12.donate, 0);

// fee=0
const s0fee = computeMonth(0, 10, { "2026-06-01": "done" });
check("A-5 fee=0 단가=0", s0fee.unit, 0);
check("A-5 fee=0 rate=10%", s0fee.rate, 10);

// target=1 (minimum guard)
const s1target = computeMonth(100000, 1, { "2026-06-01": "done" });
check("A-6 target=1 rate=100%", s1target.rate, 100);

// ────────────────────────────────────────────────────────
section("B. 구간 판정 (brackets.ts)");

check("B-1 done=0 → 구간 0", resolveBracketKey(0, 0), 0);
check("B-2 rate=1% → 구간 1", resolveBracketKey(1, 1), 1);
check("B-3 rate=25% → 구간 1 (경계)", resolveBracketKey(25, 5), 1);
check("B-4 rate=25.01% → 구간 2", resolveBracketKey(25.01, 5), 2);
check("B-5 rate=50% → 구간 2 (경계)", resolveBracketKey(50, 5), 2);
check("B-6 rate=50.01% → 구간 3", resolveBracketKey(50.01, 5), 3);
check("B-7 rate=75% → 구간 3 (경계)", resolveBracketKey(75, 5), 3);
check("B-8 rate=75.01% → 구간 4", resolveBracketKey(75.01, 5), 4);
check("B-9 rate=99.9% → 구간 4", resolveBracketKey(99.9, 5), 4);
check("B-10 rate=100% → 구간 5 (정확히)", resolveBracketKey(100, 10), 5);
check("B-11 rate=100.01% → 구간 6", resolveBracketKey(100.01, 11), 6);
check("B-12 isGraduated(100)", isGraduated(100), true);
check("B-13 isGraduated(99.9)", isGraduated(99.9), false);
check("B-14 isGraduated(150)", isGraduated(150), true);

// BRACKET_VISUALS 7개 모두 정의됐는지
const bvKeys = [0, 1, 2, 3, 4, 5, 6] as const;
check("B-15 BRACKET_VISUALS 7구간 완비", bvKeys.every(k => !!BRACKET_VISUALS[k]?.label), true);

// ────────────────────────────────────────────────────────
section("C. 콘텐츠 — 구간 헤드라인 (content.ts)");

const stats0 = computeMonth(100000, 10, {});
check("C-1 구간0 헤드라인(지갑)", headlineFor(0, stats0).includes("지갑"), true);

const stats1 = computeMonth(100000, 10, { "2026-06-01": "done" });
check("C-2 구간1 헤드라인(기부왕)", headlineFor(1, stats1).includes("기부왕"), true);

const stats5 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
check("C-3 구간5 헤드라인(본전)", headlineFor(5, stats5).includes("본전"), true);

const stats6 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
check("C-4 구간6 헤드라인(손해)", headlineFor(6, stats6).includes("손해"), true);

// ────────────────────────────────────────────────────────
section("D. 표창장 문구 (content.ts)");

const cert_fail = certificateText(s7, 2026, "6월");
check("D-1 미달 표창장 제목", cert_fail.title, "운동비 후원 표창장");
check("D-2 미달 기부액 포함", cert_fail.body.includes("기부"), true);
check("D-3 미달 share #뺄래낼래", cert_fail.share.includes("#뺄래낼래"), true);

const cert_pass = certificateText(s10, 2026, "6월");
check("D-4 달성 졸업장 제목", cert_pass.title, "본전 졸업장");
check("D-5 달성 호구 제명 포함", cert_pass.body.includes("제명") || cert_pass.body.includes("졸업"), true);
check("D-6 달성 share 완전 회수", cert_pass.share.includes("완전 회수") || cert_pass.share.includes("뽕 뽑기"), true);

// reportGrade
check("D-7 grade 100%→완전 회수", reportGrade(100).includes("완전 회수"), true);
check("D-8 grade 75%→합격", reportGrade(75).includes("합격"), true);
check("D-9 grade 50%→분발", reportGrade(50).includes("분발"), true);
check("D-10 grade 49%→반성", reportGrade(49).includes("반성"), true);

// ────────────────────────────────────────────────────────
section("E. 대표 칭호 + 프로그레스바 (titles.ts)");

const t0 = resolveTitle(0);
check("E-1 0회 → 운동 새싹", t0.current.name, "운동 새싹");
check("E-1 progressPct=0", t0.progressPct, 0);
check("E-1 next=작심삼일러", t0.next?.name, "작심삼일러");
check("E-1 remainingToNext=3", t0.remainingToNext, 3);

const t2 = resolveTitle(2);
check("E-2 2회 운동 새싹 / pct=66", t2.current.name, "운동 새싹");
check("E-2 progressPct≈66", t2.progressPct, 67); // (2-0)/(3-0)*100 = 66.7 → round → 67

const t3 = resolveTitle(3);
check("E-3 3회 → 작심삼일러", t3.current.name, "작심삼일러");
check("E-3 pct=0", t3.progressPct, 0);

const t10 = resolveTitle(10);
check("E-4 10회 → 헬스 뉴비", t10.current.name, "헬스 뉴비");

const t25 = resolveTitle(25);
check("E-5 25회 → 회수 전문가", t25.current.name, "회수 전문가");

const t45 = resolveTitle(45);
check("E-6 45회 → 본전 사냥꾼", t45.current.name, "본전 사냥꾼");

const t80 = resolveTitle(80);
check("E-7 80회 → 뽕 뽑기 달인", t80.current.name, "뽕 뽑기 달인");

const t120 = resolveTitle(120);
check("E-8 120회 → 명예 관장님", t120.current.name, "명예 관장님");
check("E-8 next=null", t120.next, null);
check("E-8 progressPct=100", t120.progressPct, 100);
check("E-8 remaining=0", t120.remainingToNext, 0);

// LEVELS 순서 정합성
check("E-9 LEVELS 7단계", LEVELS.length, 7);
for (let i = 1; i < LEVELS.length; i++) {
  check(`E-10 LEVELS[${i}].min > LEVELS[${i-1}].min`, LEVELS[i].min > LEVELS[i - 1].min, true);
}

// ────────────────────────────────────────────────────────
section("F. 출석 체크 (attendance.ts)");

const init = createInitialState();

// 비로그인 출석 — 무제한·무게이트, 기록만 토글(적립/광고 없음)
const r1 = applyCheckIn(init, "2026-06-23", "done");
check("F-1 비로그인 log=done", r1.logs["2026-06-23"], "done");
check("F-1 비로그인 points=0(no login)", r1.points, 0);

// 로그인 → +1P
const initLogin = { ...init, loggedIn: true };
const rLogin = applyCheckIn(initLogin, "2026-06-23", "done");
check("F-4 로그인 체크인 +1P", rLogin.points, 1);

// 동일 값 재클릭 → 취소
const initDone = { ...initLogin, logs: { "2026-06-23": "done" as const } };
const rToggle = applyCheckIn(initDone, "2026-06-23", "done");
check("F-5 같은 값 재클릭 취소", rToggle.logs["2026-06-23"], undefined);

// done → missed 교체
const rSwitch = applyCheckIn(initDone, "2026-06-23", "missed");
check("F-6 done→missed 교체", rSwitch.logs["2026-06-23"], "missed");

// 하루 한 번만 적립 — 토글 off→on 해도 누적 안 함(진입 +1 / 이탈 -1 상쇄)
const sDoneA = applyCheckIn(initLogin, "2026-06-23", "done"); // empty→done +1P
const sOff = applyCheckIn(sDoneA, "2026-06-23", "done"); // done→off -1P
check("F-5b off 시 적립 회수", sOff.points, 0);
const sOnAgain = applyCheckIn(sOff, "2026-06-23", "done"); // empty→done +1P
check("F-5c 토글 off→on 누적 안 함(net 1P)", sOnAgain.points, 1);

// done → missed 는 적립 회수(출석 취소)
const sDoneToMissed = applyCheckIn(sDoneA, "2026-06-23", "missed");
check("F-6b done→missed 적립 회수", sDoneToMissed.points, 0);

// '안 갔어요'(missed)는 적립 없음
const rMissedLogin = applyCheckIn(initLogin, "2026-06-23", "missed");
check("F-6c 로그인 missed 적립 없음", rMissedLogin.points, 0);
const rMissedFree = applyCheckIn(init, "2026-06-23", "missed");
check("F-6d 비로그인 missed 기록만", rMissedFree.logs["2026-06-23"], "missed");

// totalDone
const logs = { "2026-06-01": "done" as const, "2026-06-02": "missed" as const, "2026-06-03": "done" as const };
check("F-7 totalDone=2", totalDone(logs), 2);

// cycleCalendarDay: 빈→done
const cycled1 = cycleCalendarDay(init, "2026-06-01");
check("F-11 cycle 빈→done", cycled1.logs["2026-06-01"], "done");
// done→missed
const cycled2 = cycleCalendarDay(cycled1, "2026-06-01");
check("F-12 cycle done→missed", cycled2.logs["2026-06-01"], "missed");

// monthsGraduated
const gradLogs = {
  "2026-05-01": "done" as const, "2026-05-02": "done" as const, // target=2 이면 졸업
};
check("F-13 monthsGraduated target=2", monthsGraduated(gradLogs, 2), 1);
check("F-14 monthsGraduated target=3", monthsGraduated(gradLogs, 3), 0);

// ────────────────────────────────────────────────────────
section("G. 보호권 (freeze.ts)");

const initP4 = { ...init, loggedIn: true, points: 4 };
check("G-1 4P canBuyFreeze=false", canBuyFreeze(initP4), false);
check("G-2 4P applyBuyFreeze=null", applyBuyFreeze(initP4), null);

const initP5 = { ...init, loggedIn: true, points: 5 };
check("G-3 5P canBuyFreeze=true", canBuyFreeze(initP5), true);
const bought = applyBuyFreeze(initP5);
check("G-4 5P 구매 후 points=0", bought?.points, 0);
check("G-5 5P 구매 후 freezes=1", bought?.freezes, 1);

const adFreeze = applyFreezeFromAd(init);
check("G-6 광고 보호권 freezes=1", adFreeze.freezes, 1);
check("G-7 광고 보호권 points 변화없음", adFreeze.points, 0);

// ────────────────────────────────────────────────────────
section("H. 데이터 정규화 (model.ts)");

// sanitizeLogs
const nowDate = new Date("2026-06-23");
const raw = {
  "2026-06-01": "done",
  "2026-06-30": "done",        // 미래 (6/23 기준)
  "2025-12-31": "done",        // CALENDAR_MIN 이전 (2026-01-01 이전)
  "bad-date": "done",          // 형식 오류
  "2026-06-02": "invalid",     // 잘못된 값
  "2026-06-03": "missed",
};
const sanitized = sanitizeLogs(raw, nowDate);
check("H-1 유효한 로그만 통과", Object.keys(sanitized).sort().join(","), "2026-06-01,2026-06-03");
check("H-2 미래 날짜 폐기", "2026-06-30" in sanitized, false);
check("H-3 MIN 이전 폐기", "2025-12-31" in sanitized, false);
check("H-4 잘못된 값 폐기", "2026-06-02" in sanitized, false);

// normalizeState — 손상된 값 복구
const normalized = normalizeState({ fee: -100, target: 0, points: -5 });
check("H-5 fee 음수 → 기본값", normalized.fee, 100000);
check("H-6 target 0 → 기본값", normalized.target, 12);
check("H-7 points 음수 → 0", normalized.points, 0);

// 월별 설정 스냅샷 정규화 (model.ts)
const ms = sanitizeMonthSettings({
  "2026-05": { fee: 80000, target: 10 },
  "2026-06": { fee: -5, target: 0 }, // fee 음수→기본, target 0→기본
  "badkey": { fee: 1, target: 1 }, // 형식 불일치 → 제외
  "2026-07": "nope", // 객체 아님 → 제외
});
check("H-9 유효 월만 통과", Object.keys(ms).sort().join(","), "2026-05,2026-06");
check("H-10 정상 스냅샷 유지", ms["2026-05"].fee, 80000);
check("H-11 fee 음수 → 기본값", ms["2026-06"].fee, 100000);
check("H-12 target 0 → 기본값", ms["2026-06"].target, 12);
check("H-13 normalizeState 기본 monthSettings {}", Object.keys(normalizeState({}).monthSettings).length, 0);
check(
  "H-14 normalizeState monthSettings 보존",
  normalizeState({ monthSettings: { "2026-05": { fee: 50000, target: 8 } } }).monthSettings["2026-05"].target,
  8,
);

// ────────────────────────────────────────────────────────
section("I. 출석 상태 메시지 (content.ts)");

const statusDone = todayCheckInStatusText("done", 10000, true);
check("I-1 done+로그인 메시지", statusDone.text.includes("+1P"), true);
check("I-1 done kind", statusDone.kind, "done");

const statusDoneGuest = todayCheckInStatusText("done", 10000, false);
check("I-2 done+비로그인 +1P없음", statusDoneGuest.text.includes("+1P"), false);
check("I-2 done+비로그인 회수 포함", statusDoneGuest.text.includes("회수"), true);

const statusMissed = todayCheckInStatusText("missed", 10000, true);
check("I-3 missed kind", statusMissed.kind, "missed");
check("I-3 missed 증발 포함", statusMissed.text.includes("증발"), true);

const statusNeutral = todayCheckInStatusText(null, 10000, false);
check("I-4 null neutral", statusNeutral.kind, "neutral");

// ────────────────────────────────────────────────────────
section("J. 스트릭 + 보호권 확인 후 복구 (streak.ts)");

const J_NOW = new Date(2026, 5, 10); // 2026-06-10 (로컬)
function mkState(over: Partial<PlnlState>): PlnlState {
  return { ...createInitialState(), loggedIn: true, ...over };
}
// 오늘탭 출석(checkins) 헬퍼 — 스트릭/보호권은 이 날짜 집합으로만 센다(달력 logs 와 분리).
const ci = (...keys: string[]): string[] => keys;

// currentStreak — frozen 인지
check(
  "J-1 오늘+직전 2일 done → 3",
  currentStreak(ci("2026-06-08", "2026-06-09", "2026-06-10"), [], J_NOW),
  3,
);
check(
  "J-2 오늘 미체크 → 0 (푸시 의도)",
  currentStreak(ci("2026-06-08", "2026-06-09"), [], J_NOW),
  0,
);
check(
  "J-3 중간 빠진 날 frozen 이면 이어짐(frozen 도 카운트 → 4)",
  currentStreak(ci("2026-06-07", "2026-06-08", "2026-06-10"), ["2026-06-09"], J_NOW),
  4,
);
check(
  "J-4 빠진 날 frozen 아니면 끊김 → 1",
  currentStreak(ci("2026-06-08", "2026-06-10"), [], J_NOW),
  1,
);

// detectFreezeRepair — 제안 감지 (차감 X)
check(
  "J-5 빈틈 없음(어제 done) → 제안 없음",
  detectFreezeRepair(mkState({ checkins: ci("2026-06-09"), freezes: 2 }), J_NOW),
  null,
);
const det6 = detectFreezeRepair(mkState({ checkins: ci("2026-06-08"), freezes: 2 }), J_NOW);
check("J-6 빈 1일 + 보호권 충분 → 제안", det6, { days: ["2026-06-09"] });
check(
  "J-7 빈 2일 + 보호권 1개 → all-or-nothing, 제안 없음",
  detectFreezeRepair(mkState({ checkins: ci("2026-06-07"), freezes: 1 }), J_NOW),
  null,
);
check(
  "J-8 명시적 missed 만나면 → 제안 없음(본인 인정 결석)",
  detectFreezeRepair(
    mkState({ logs: { "2026-06-09": "missed" }, checkins: ci("2026-06-08"), freezes: 2 }),
    J_NOW,
  ),
  null,
);
check(
  "J-9 앵커(done) 없으면 → 제안 없음",
  detectFreezeRepair(mkState({ freezes: 2 }), J_NOW),
  null,
);

// applyFreezeRepair — 동의 시 차감
const base6 = mkState({ checkins: ci("2026-06-08"), freezes: 2 });
const applied = applyFreezeRepair(base6, det6!.days);
check("J-10 동의 → 보호권 1 차감", applied.freezes, 1);
check("J-10 frozen=[06-09]", applied.frozen, ["2026-06-09"]);
check(
  "J-11 복구 뒤 오늘 체크 시 연속 유지(done2+frozen1=3)",
  currentStreak([...applied.checkins, "2026-06-10"], applied.frozen, J_NOW),
  3,
);
check(
  "J-12 복구 뒤 재감지 → 제안 없음(멱등)",
  detectFreezeRepair(applied, J_NOW),
  null,
);

// declineFreezeRepair — 거절 시 missed 기록 (보호권 안 씀)
const declined = declineFreezeRepair(base6, det6!.days);
check("J-13 거절 → 보호권 그대로(2)", declined.freezes, 2);
check("J-13 거절 → 06-09=missed", declined.logs["2026-06-09"], "missed");
check(
  "J-14 거절 뒤 재감지 → 제안 없음(다시 안 물음)",
  detectFreezeRepair(declined, J_NOW),
  null,
);

// sanitizeDateList — 방어적 정규화
check(
  "J-15 유효 날짜만·정렬·중복제거",
  sanitizeDateList(["2026-06-09", "2026-06-09", "bad", "2999-01-01"], J_NOW),
  ["2026-06-09"],
);

// ────────────────────────────────────────────────────────
section("K. 스트릭 카운트 스펙 변경 + 상태 팝업 감지 (streak.ts)");

// K-1 frozen 도 카운트(브릿지 포함): done 3 + frozen 2 = 5
check(
  "K-1 frozen 2일 브릿지 포함 카운트=5",
  currentStreak(
    ci("2026-06-06", "2026-06-07", "2026-06-10"),
    ["2026-06-08", "2026-06-09"],
    J_NOW,
  ),
  5,
);

// K-2 bestStreakAll 도 frozen 합집합 → 현재 스트릭과 모순 없음
check(
  "K-2 bestStreakAll frozen 합집합=5",
  bestStreakAll(ci("2026-06-06", "2026-06-07", "2026-06-10"), ["2026-06-08", "2026-06-09"]),
  5,
);
check(
  "K-2b bestStreakAll checkins만(frozen 기본 [])",
  bestStreakAll(ci("2026-06-08", "2026-06-09", "2026-06-10")),
  3,
);

// livingStreak — 오늘 인증 전에도 어제까지의 연속을 표시(리빙 스트릭)
check(
  "K-L1 오늘 체크 → 오늘 포함(3)",
  livingStreak(ci("2026-06-08", "2026-06-09", "2026-06-10"), [], J_NOW),
  3,
);
check(
  "K-L2 오늘 미체크 + 어제까지 3일 → 3 (currentStreak 은 0)",
  livingStreak(ci("2026-06-07", "2026-06-08", "2026-06-09"), [], J_NOW),
  3,
);
check(
  "K-L2b 같은 상태에서 currentStreak 는 0(푸시 로직 보존)",
  currentStreak(ci("2026-06-07", "2026-06-08", "2026-06-09"), [], J_NOW),
  0,
);
check(
  "K-L3 보호권으로 어제 메움 + 오늘 미체크 → 4 (done3 + frozen1)",
  livingStreak(ci("2026-06-06", "2026-06-07", "2026-06-08"), ["2026-06-09"], J_NOW),
  4,
);
check(
  "K-L4 완전히 끊김(어제도 0) → 0",
  livingStreak(ci("2026-06-05", "2026-06-06", "2026-06-07"), [], J_NOW),
  0,
);

// detectStreakStatusPopup — milestone (3·7·14·30일 달성 → 보상 팝업)
const kMilestone = mkState({ checkins: ci("2026-06-08", "2026-06-09", "2026-06-10") }); // streak 3
check(
  "K-3 오늘체크+3일(마일스톤 도달·미수령) → milestone",
  detectStreakStatusPopup(kMilestone, J_NOW),
  { kind: "milestone", streak: 3, milestone: 3 },
);
check(
  "K-3b 보호권 복구 후 오늘 미체크지만 리빙 3일 → milestone (핵심)",
  detectStreakStatusPopup(
    mkState({ checkins: ci("2026-06-06", "2026-06-07", "2026-06-08"), frozen: ["2026-06-09"] }),
    J_NOW,
  ),
  { kind: "milestone", streak: 4, milestone: 3 },
);
check(
  "K-4 이 마일스톤 팝업 이미 봄(streakMilestoneSeen=[3]) → null",
  detectStreakStatusPopup({ ...kMilestone, streakMilestoneSeen: [3] }, J_NOW),
  null,
);
check(
  "K-4b 이미 수령(claimed=[3]) → null",
  detectStreakStatusPopup({ ...kMilestone, claimed: [3] }, J_NOW),
  null,
);
check(
  "K-5 streak 2(마일스톤 미도달) → null (유지 중 팝업 제거)",
  detectStreakStatusPopup(mkState({ checkins: ci("2026-06-09", "2026-06-10") }), J_NOW),
  null,
);
check(
  "K-6 오늘 미체크(어제까지 2일) → null (오늘 인증 유도 팝업 제거)",
  detectStreakStatusPopup(mkState({ checkins: ci("2026-06-08", "2026-06-09") }), J_NOW),
  null,
);

// detectStreakStatusPopup — broken
const kBroken = mkState({ checkins: ci("2026-06-05", "2026-06-06", "2026-06-07") });
check(
  "K-7 3일 끊김 + 보호권0 → broken(lost=3, anchor=마지막 checkin)",
  detectStreakStatusPopup(kBroken, J_NOW),
  { kind: "broken", lostStreak: 3, anchor: "2026-06-07" },
);
check(
  "K-8 3일 끊김 + 보호권 충분 → null(복구 제안 우선)",
  detectStreakStatusPopup({ ...kBroken, freezes: 3 }, J_NOW),
  null,
);
check(
  "K-9 이 끊김 이미 봄(마커=anchor) → null",
  detectStreakStatusPopup({ ...kBroken, streakBrokenSeenOn: "2026-06-07" }, J_NOW),
  null,
);
check(
  "K-10 잃은 기록 1일(최소 2일 미만) → null",
  detectStreakStatusPopup(mkState({ checkins: ci("2026-06-07") }), J_NOW),
  null,
);

// 공통 가드
check(
  "K-11 비로그인 → null",
  detectStreakStatusPopup({ ...kMilestone, loggedIn: false }, J_NOW),
  null,
);
// (K-12 mergeForLogin 마커 local 유지는 supabase import 때문에 여기서 못 돌림 → docs QA H-3 수동 검증)

// ────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(55)}`);
console.log(`결과: ✅ ${passed}개 통과 / ❌ ${failed}개 실패 / 합계 ${passed + failed}개`);
if (failures.length > 0) {
  console.log("\n실패 목록:");
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log("전체 통과! 🎉");
}
