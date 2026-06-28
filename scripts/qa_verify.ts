// QA 로직 검증 스크립트 — 순수 함수 전수 테스트
// 실행: npx tsx scripts/qa_verify.ts

import { computeMonth, unitCost } from "../src/lib/calc";
import { resolveBracketKey, isGraduated } from "../src/lib/brackets";
import {
  BRACKET_VISUALS,
  LEVELS,
  STREAK_MILESTONES,
  captionsFor,
  certificateText,
  reportGrade,
  freeCheckinTagText,
  todayCheckInStatusText,
  AD_UNLOCKED_TAG,
} from "../src/lib/content";
import { resolveTitle } from "../src/lib/titles";
import {
  applyCheckIn,
  freeCheckinsLeft,
  totalDone,
  monthsGraduated,
  cycleCalendarDay,
} from "../src/lib/attendance";
import { applyBuyFreeze, applyFreezeFromAd, canBuyFreeze } from "../src/lib/freeze";
import {
  currentStreak,
  detectFreezeRepair,
  applyFreezeRepair,
  declineFreezeRepair,
} from "../src/lib/streak";
import {
  normalizeState,
  sanitizeLogs,
  sanitizeDateList,
  createInitialState,
  type Logs,
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
section("C. 콘텐츠 — 구간 카피 (content.ts)");

const stats0 = computeMonth(100000, 10, {});
const caps0 = captionsFor(0, stats0);
check("C-1 구간0 헤드라인 포함(지갑)", caps0[0].includes("지갑"), true);

const stats1 = computeMonth(100000, 10, { "2026-06-01": "done" });
const caps1 = captionsFor(1, stats1);
check("C-2 구간1 헤드라인 포함(후원)", caps1[0].includes("후원"), true);

const stats5 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
const caps5 = captionsFor(5, stats5);
check("C-3 구간5 호구졸업 포함", caps5[0].includes("호구 졸업") || caps5[1].includes("호구 졸업"), true);

const stats6 = computeMonth(100000, 10, Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`2026-06-${String(i + 1).padStart(2, "0")}`, "done"])
));
const caps6 = captionsFor(6, stats6);
check("C-4 구간6 초과 포함", caps6[0].includes("기부") || caps6[0].includes("시설"), true);

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
check("E-8 120회 → 명예 헬창", t120.current.name, "명예 헬창");
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

// 비로그인 무료 3회
const r1 = applyCheckIn(init, "2026-06-23", "done");
check("F-1 비로그인 1회 ok", r1.ok, true);
if (r1.ok) {
  check("F-1 freeUsed=1", r1.next.freeUsed, 1);
  check("F-1 points=0(no login)", r1.next.points, 0);
  check("F-1 log=done", r1.next.logs["2026-06-23"], "done");
}

// 무료 3회 소진
const init3 = { ...init, freeUsed: 3 };
const rAd = applyCheckIn(init3, "2026-06-23", "done");
check("F-2 무료 소진 → need_ad", rAd.ok, false);
if (!rAd.ok) check("F-2 reason=need_ad", rAd.reason, "need_ad");

// adUnlocked 후 출석
const initAd = { ...init3, adUnlocked: true };
const rUnlocked = applyCheckIn(initAd, "2026-06-23", "done");
check("F-3 광고 언락 후 체크인 ok", rUnlocked.ok, true);
if (rUnlocked.ok) {
  check("F-3 adUnlocked 소진", rUnlocked.next.adUnlocked, false);
  check("F-3 log=done", rUnlocked.next.logs["2026-06-23"], "done");
}

// 로그인 → +1P
const initLogin = { ...init, loggedIn: true };
const rLogin = applyCheckIn(initLogin, "2026-06-23", "done");
check("F-4 로그인 체크인 +1P", rLogin.ok ? rLogin.next.points : -1, 1);

// 동일 값 재클릭 → 취소
const initDone = { ...initLogin, logs: { "2026-06-23": "done" as const } };
const rToggle = applyCheckIn(initDone, "2026-06-23", "done");
check("F-5 같은 값 재클릭 취소", rToggle.ok ? rToggle.next.logs["2026-06-23"] : "X", undefined);

// done → missed 교체
const rSwitch = applyCheckIn(initDone, "2026-06-23", "missed");
check("F-6 done→missed 교체 ok", rSwitch.ok, true);
if (rSwitch.ok) check("F-6 log=missed", rSwitch.next.logs["2026-06-23"], "missed");

// totalDone
const logs = { "2026-06-01": "done" as const, "2026-06-02": "missed" as const, "2026-06-03": "done" as const };
check("F-7 totalDone=2", totalDone(logs), 2);
check("F-8 freeCheckinsLeft init=3", freeCheckinsLeft(init), 3);
check("F-9 freeCheckinsLeft freeUsed=2 → 1", freeCheckinsLeft({ ...init, freeUsed: 2 }), 1);
check("F-10 freeCheckinsLeft freeUsed=3 → 0", freeCheckinsLeft({ ...init, freeUsed: 3 }), 0);

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
const normalized = normalizeState({ fee: -100, target: 0, points: -5, freeUsed: "abc" });
check("H-5 fee 음수 → 기본값", normalized.fee, 100000);
check("H-6 target 0 → 기본값", normalized.target, 12);
check("H-7 points 음수 → 0", normalized.points, 0);
check("H-8 freeUsed 문자 → 0", normalized.freeUsed, 0);

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

check("I-5 freeCheckinTagText(3)", freeCheckinTagText(3).includes("3"), true);
check("I-6 freeCheckinTagText(1)", freeCheckinTagText(1).includes("1"), true);
check("I-7 AD_UNLOCKED_TAG 존재", AD_UNLOCKED_TAG.length > 0, true);

// ────────────────────────────────────────────────────────
section("J. 스트릭 + 보호권 확인 후 복구 (streak.ts)");

const J_NOW = new Date(2026, 5, 10); // 2026-06-10 (로컬)
function mkState(over: Partial<PlnlState>): PlnlState {
  return { ...createInitialState(), loggedIn: true, ...over };
}
const done = (...keys: string[]): Logs =>
  Object.fromEntries(keys.map((k) => [k, "done" as const]));
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
  "J-3 중간 빠진 날 frozen 이면 이어짐(카운트는 done만=3)",
  currentStreak(ci("2026-06-07", "2026-06-08", "2026-06-10"), ["2026-06-09"], J_NOW),
  3,
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
  "J-11 복구 뒤 오늘 체크 시 연속 유지(2)",
  currentStreak([...applied.checkins, "2026-06-10"], applied.frozen, J_NOW),
  2,
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
console.log(`\n${"═".repeat(55)}`);
console.log(`결과: ✅ ${passed}개 통과 / ❌ ${failed}개 실패 / 합계 ${passed + failed}개`);
if (failures.length > 0) {
  console.log("\n실패 목록:");
  failures.forEach(f => console.log(f));
  process.exit(1);
} else {
  console.log("전체 통과! 🎉");
}
