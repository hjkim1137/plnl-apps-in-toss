import { useState } from "react";
import { AdButton } from "../components/AdButton";
import type { PlnlController } from "../hooks/usePlnl";
import {
  AD_UNLOCKED_TAG,
  freeCheckinTagText,
  todayCheckInStatusText,
} from "../lib/content";
import { wonN } from "../lib/format";
import { useToast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-bridge";

// ── 오늘 탭 ──────────────────────────────────────────────────────────────
// TODO(인정/A): 아래 plain DOM 을 TDS 컴포넌트로 교체. 데이터/액션은 plnl 에서 그대로 사용.
// 이 파일은 usePlnl 가 노출하는 값의 "살아있는 스펙" 이기도 함.

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: "20px 18px",
        marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
    >
      {children}
    </div>
  );
}

export function TodayScreen({ plnl, onOpenLogin }: { plnl: PlnlController; onOpenLogin: () => void }) {
  const { today, checkin, game, actions, state, repair } = plnl;
  const { openToast } = useToast();
  const s = today.stats;
  const [localChoice, setLocalChoice] = useState<"done" | "missed" | null>(null);

  // 비로그인 버튼 위 안내 태그
  const freeTag = (() => {
    if (state.loggedIn || today.todayValue != null || localChoice != null) return null;
    if (state.adUnlocked) return AD_UNLOCKED_TAG;
    if (checkin.freeLeft > 0) return freeCheckinTagText(checkin.freeLeft);
    return null;
  })();

  return (
    <div>
      {/* 1) 오늘의 선택 */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontWeight: 700, color: "#6b7684", margin: 0 }}>
            오늘의 선택{" "}
            {!state.loggedIn && (
              <small style={{ color: "#8b95a1" }}>
                · 무료 {checkin.freeLeft}/3
              </small>
            )}
          </p>
          {state.loggedIn && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff7e0", border: "1px solid #ffe4a0", borderRadius: 999, padding: "5px 12px" }}>
              <span style={{ fontSize: 14 }}>💰</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#b07a00" }}>{state.points}P</span>
            </div>
          )}
        </div>


        {freeTag && (
          <div style={{ fontSize: 12, fontWeight: 700, color: state.adUnlocked ? "#15b877" : "#5DC528", textAlign: "center", marginBottom: 10 }}>
            {freeTag}
          </div>
        )}

        {checkin.mode === "buttons" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { if (localChoice !== "done") { generateHapticFeedback({ type: "tap" }); actions.checkIn("done"); setLocalChoice("done"); openToast(todayCheckInStatusText("done", s.unit, state.loggedIn).text); } }}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: localChoice === "done" ? "#5DC528" : "#edfadf", color: localChoice === "missed" ? "#b0b8c1" : localChoice === "done" ? "#fff" : "#4e5968", cursor: localChoice === "done" ? "default" : "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              오늘 갔어요
            </button>
            <button
              onClick={() => { if (localChoice !== "missed") { generateHapticFeedback({ type: "tap" }); actions.checkIn("missed"); setLocalChoice("missed"); openToast(todayCheckInStatusText("missed", s.unit, state.loggedIn).text.replace("… ", "…\n")); } }}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: localChoice === "missed" ? "#f04452" : "#fff0f1", color: localChoice === "done" ? "#b0b8c1" : localChoice === "missed" ? "#fff" : "#4e5968", cursor: localChoice === "missed" ? "default" : "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              오늘 안 갔어요
            </button>
          </div>
        ) : (
          // 무료 소진 → 전면형 광고 게이트. 시청 완료 시 1회 언락되고 위 버튼이 나타남.
          <>
            <AdButton
              onRun={() => actions.watchCheckinAd()}
              style={{ width: "100%", padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              📺 짧은 광고 보고 출석 체크하기
            </AdButton>
            <div style={{ textAlign: "center", fontSize: 12, color: "#8b95a1", marginTop: 10 }}>
              또는{" "}
              <span
                onClick={onOpenLogin}
                style={{ color: "#5DC528", fontWeight: 800, cursor: "pointer" }}
              >
                토스 로그인하고 광고 없이 무제한 + 포인트 받기
              </span>
            </div>
          </>
        )}

      </Card>

      {/* 2+3) 회수율 헤드라인 + 이번 달 회수율 게이지 */}
      <div style={{ borderRadius: 18, padding: 22, marginBottom: 14, color: "#fff", background: today.bracket.bgGradient }}>
        <p style={{ fontWeight: 700, color: "rgba(255,255,255,.85)", margin: "0 0 14px" }}>
          {today.monthLabel} 회수율<span style={{ fontWeight: 500, fontSize: 12, opacity: 0.8, marginLeft: 4 }}>(1회 운동 단가: {wonN(s.unit)}원)</span>
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1 }}>{s.rate}</div>
            <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.85 }}>% 회수</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{today.bracket.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3 }}>{today.bracket.label}</div>
          </div>
        </div>
        <div style={{ height: 12, background: "rgba(255,255,255,.28)", borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${Math.min(100, s.rateRaw)}%`, background: "rgba(255,255,255,.75)", borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{today.headline}</div>
      </div>

      {/* 4) 로그인 전용: 등급 / 스트릭 / 포인트 (게스트는 잠금 — A가 lock UI) */}
      {state.loggedIn ? (
        <>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>내 등급</p>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "#eef4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {game.title.current.emoji}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>
                  {game.title.current.name}
                </div>
                <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600, marginTop: 2 }}>
                  누적 인증 {game.totalDone}회 · 본전 졸업 {game.monthsGraduated}회
                </div>
              </div>
            </div>
            <div style={{ height: 12, background: "#f2f4f6", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${game.title.progressPct}%`, borderRadius: 999, background: "linear-gradient(90deg,#5DC528,#7de34a)", transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#8b95a1", fontWeight: 600, textAlign: "right" }}>
              {game.title.next
                ? `다음 등급 「${game.title.next.name}」까지 인증 ${game.title.remainingToNext}회`
                : "최고 등급 달성! 👑"}
            </div>
          </Card>
          {/* 보호권 복구 제안 (확인 후 복구) — 동의해야만 보호권 차감 */}
          {repair && (
            <div style={{ background: "#edfadf", border: "1px solid #c5f0a0", borderRadius: 18, padding: 18, marginBottom: 14 }}>
              <p style={{ fontWeight: 800, color: "#3a8a12", margin: "0 0 4px" }}>
                🛡️ 빠진 날이 있어요
              </p>
              <p style={{ fontSize: 13, color: "#4e7a20", margin: "0 0 12px", lineHeight: 1.5 }}>
                {repair.count}일 빠졌어요. 보호권 {repair.count}개로 연속을 지킬까요?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => actions.confirmFreezeRepair()}
                  style={{ flex: 1, padding: 12, border: "none", borderRadius: 12, fontWeight: 800, background: "#5DC528", color: "#fff" }}
                >
                  🛡️ 지키기 (보호권 {repair.count}개)
                </button>
                <button
                  onClick={() => actions.dismissFreezeRepair()}
                  style={{ flex: "0 0 auto", padding: "12px 16px", border: "1px solid #cfe0ff", borderRadius: 12, fontWeight: 700, background: "#fff", color: "#6b7684" }}
                >
                  괜찮아요
                </button>
              </div>
            </div>
          )}
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>나의 연속 인증 기록</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 26 }}>🔥</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>
                  <b style={{ color: "#ff8a00" }}>{game.streak}</b>일 연속 인증 중
                </div>
                <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600 }}>
                  {game.streak === 0 ? "오늘 출석하면 스트릭 시작!" : "이 불 끄지 마세요"}
                </div>
              </div>
            </div>
            <div style={{ height: 12, background: "#f2f4f6", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#ff8a00,#ffb800)", width: `${Math.min(100, game.streak > 0 ? (game.streak / (game.milestoneChips[game.milestoneChips.length - 1]?.d ?? 30)) * 100 : 0)}%`, transition: "width .5s" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {game.milestoneChips.map((c) => (
                <span key={c.d} style={{ flex: 1, textAlign: "center", borderRadius: 10, padding: "7px 2px", fontSize: 11, fontWeight: 800, background: c.status === "got" ? "#fff3d6" : c.status === "ready" ? "#ffe7a8" : "#f2f4f6", color: c.status === "locked" ? "#b0b8c1" : "#b07a00" }}>
                  {c.d}일<br />{c.status === "got" ? "받음" : `+${c.p}P`}
                </span>
              ))}
            </div>
            {game.claimableMilestone ? (
              <AdButton
                onRun={() => actions.claimMilestone()}
                style={{ width: "100%", marginTop: 12, padding: 13, border: "none", borderRadius: 13, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              >
                🎁 광고보고 포인트 받기 (+{game.claimableMilestone.p}P · {game.claimableMilestone.d}일)
              </AdButton>
            ) : (
              <div style={{ fontSize: 11.5, color: "#ff8a00", fontWeight: 700, marginTop: 10, textAlign: "center" }}>
                🎁 3·7·14·30일 달성마다 광고 보고 포인트 받기
              </div>
            )}
          </Card>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>출석 인증 포인트</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff7e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>💰</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
                  <b style={{ color: "#ffb800" }}>{game.points}</b> P
                </div>
                <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600 }}>출석 1회 = 1P 적립 중</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f9fafb", border: "1px solid #f2f4f6", borderRadius: 14, padding: 13, marginBottom: 10 }}>
              <div style={{ fontSize: 22 }}>🛡️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#333d4b" }}>
                  스트릭 보호권 <span style={{ color: "#ff8a00", fontWeight: 700, fontSize: 11, marginLeft: 4 }}>보유 {game.freezes}개</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#8b95a1", marginTop: 2, lineHeight: 1.4 }}>
                  빠진 날에도 연속 출석이 끊기지 않게 막아줘요
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { if (actions.buyFreeze().ok) openToast("스트릭 보호권이 생겼어요"); }}
                disabled={!game.canBuyFreeze}
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: game.canBuyFreeze ? "#5DC528" : "#e5e8eb", color: game.canBuyFreeze ? "#fff" : "#b0b8c1", cursor: game.canBuyFreeze ? "pointer" : "not-allowed", fontFamily: "inherit" }}
              >
                5P로 받기
              </button>
              <AdButton
                onRun={() => actions.watchFreezeAd()}
                onDone={(r) => { if (r.ok) openToast("스트릭 보호권이 생겼어요"); }}
                loadingLabel=""
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              >
                광고 보고 받기
              </AdButton>
            </div>
          </Card>
        </>
      ) : (
        <>
          <LockCard emoji="🏅" title="내 등급" desc="출석할수록 등급 상승 — 작심삼일러 → 회수 전문가 → 뽕 뽑기 달인 → 명예 헬창" onLogin={onOpenLogin} />
          <LockCard emoji="🔥" title="연속 출석 스트릭" desc="로그인하면 연속 출석 + 광고 보고 마일스톤 포인트를 받아요" onLogin={onOpenLogin} />
          <LockCard emoji="💰" title="출석 인증 포인트" desc="출석마다 1P 적립 → 스트릭 보호권으로 연속 기록을 지켜요" onLogin={onOpenLogin} />
        </>
      )}

      {/* 6) 회원님께 한마디 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>회원님께 한마디</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#4e5968", fontSize: 13.5, lineHeight: 1.7 }}>
          {today.captions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function LockCard({ emoji, title, desc, onLogin }: { emoji: string; title: string; desc: string; onLogin: () => void }) {
  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,.04)", position: "relative", overflow: "hidden" }}>
      <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>{emoji} {title}</p>
      {/* 블러 플레이스홀더 — 버튼이 잘리지 않도록 충분한 높이 확보 */}
      <div style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
        <div style={{ height: 54, background: "#f2f4f6", borderRadius: 12, marginBottom: 8 }} />
        <div style={{ height: 14, width: "60%", background: "#f2f4f6", borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 38, background: "#f2f4f6", borderRadius: 999 }} />
      </div>
      {/* 베일 오버레이 */}
      <div style={{
        position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)",
        borderRadius: 18, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6, padding: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 26 }}>🔒</div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#333d4b" }}>{title} · 로그인 전용</div>
        <div style={{ fontSize: 11.5, color: "#8b95a1", lineHeight: 1.4 }}>{desc}</div>
        <button
          onClick={onLogin}
          style={{ marginTop: 6, background: "#5DC528", color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
        >
          토스 로그인하기
        </button>
      </div>
    </div>
  );
}
