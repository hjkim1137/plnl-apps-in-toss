import type { PlnlController } from "../hooks/usePlnl";
import {
  AD_UNLOCKED_TAG,
  freeCheckinTagText,
  todayCheckInStatusText,
} from "../lib/content";
import { won, wonN } from "../lib/format";
import { useToast } from "@toss/tds-mobile";

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
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
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
  const statusMsg = todayCheckInStatusText(today.todayValue, s.unit, state.loggedIn);

  // 비로그인 버튼 위 안내 태그
  const freeTag = (() => {
    if (state.loggedIn || today.todayValue != null) return null;
    if (state.adUnlocked) return AD_UNLOCKED_TAG;
    if (checkin.freeLeft > 0) return freeCheckinTagText(checkin.freeLeft);
    return null;
  })();

  return (
    <div>
      {/* 1) 오늘의 선택 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>
          🔔 오늘의 선택{" "}
          {!state.loggedIn && (
            <small style={{ color: "#8b95a1" }}>
              · 무료 {checkin.freeLeft}/3
            </small>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "#edfadf", borderRadius: 14, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#3a8a12", fontWeight: 700 }}>오늘 가면</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#3a8a12" }}>
              +{won(today.choice.goReward)}
            </div>
            <div style={{ fontSize: 11, color: "#8b95a1" }}>
              회수율 {today.choice.projectedRateIfGo}% 로
            </div>
          </div>
          <div style={{ flex: 1, background: "#fff0f1", borderRadius: 14, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#f04452", fontWeight: 700 }}>안 가면</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f04452" }}>
              {won(today.choice.skipLoss)}
            </div>
            <div style={{ fontSize: 11, color: "#8b95a1" }}>회수 기회 증발 😢</div>
          </div>
        </div>

        {freeTag && (
          <div style={{ fontSize: 12, fontWeight: 700, color: state.adUnlocked ? "#15b877" : "#5DC528", textAlign: "center", marginBottom: 10 }}>
            {freeTag}
          </div>
        )}

        {checkin.mode === "buttons" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => actions.checkIn("done")}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: today.todayValue === "done" ? "#5DC528" : "#edfadf", color: today.todayValue === "missed" ? "#b0b8c1" : today.todayValue === "done" ? "#fff" : "#4e5968", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              오늘 갔어요 💪
            </button>
            <button
              onClick={() => actions.checkIn("missed")}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: today.todayValue === "missed" ? "#f04452" : "#fff0f1", color: today.todayValue === "done" ? "#b0b8c1" : today.todayValue === "missed" ? "#fff" : "#4e5968", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              오늘 안 갔어요 💸
            </button>
          </div>
        ) : (
          // 무료 소진 → 전면형 광고 게이트. 시청 완료 시 1회 언락되고 위 버튼이 나타남.
          <>
            <button
              onClick={() => actions.watchCheckinAd()}
              style={{ width: "100%", padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}
            >
              📺 짧은 광고 보고 출석 체크하기
            </button>
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

        {/* 출석 체크 후 상태 메시지 */}
        <div style={{
          marginTop: 12,
          padding: "12px 14px",
          borderRadius: 12,
          fontSize: 13.5,
          fontWeight: 600,
          textAlign: "center",
          background: statusMsg.kind === "done" ? "#e7f9f1" : statusMsg.kind === "missed" ? "#fdeced" : "#f2f4f6",
          color: statusMsg.kind === "done" ? "#15b877" : statusMsg.kind === "missed" ? "#f04452" : "#6b7684",
        }}>
          {statusMsg.text}
          {statusMsg.kind === "done" && state.loggedIn && (
            <span style={{ display: "inline-block", background: "#fff7e0", color: "#b07a00", fontWeight: 800, fontSize: 11, padding: "2px 8px", borderRadius: 999, marginLeft: 6 }}>
              +1P
            </span>
          )}
        </div>
      </Card>

      {/* 2) 회수율 헤드라인 */}
      <div style={{ borderRadius: 18, padding: 22, marginBottom: 14, color: "#fff", background: today.bracket.bgGradient }}>
        <span style={{ display: "inline-block", background: "rgba(255,255,255,.22)", fontSize: 12, fontWeight: 800, padding: "5px 11px", borderRadius: 999 }}>
          회수율 {s.rate}%
        </span>
        <div style={{ fontSize: 34, marginTop: 8 }}>{today.bracket.emoji}</div>
        <h2 style={{ margin: "4px 0", fontSize: 23, fontWeight: 800 }}>{today.bracket.label}</h2>
        <div style={{ fontSize: 13.5, opacity: 0.92 }}>{today.headline}</div>
      </div>

      {/* 3) 이번 달 회수율 게이지 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>📅 {today.monthLabel} 회수율</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: today.bracket.barColor }}>{s.rate}</div>
          <div style={{ fontSize: 15, color: "#8b95a1", fontWeight: 700 }}>% 회수</div>
        </div>
        <div style={{ height: 14, background: "#f2f4f6", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
          <div style={{ height: "100%", width: `${Math.min(100, s.rateRaw)}%`, background: today.bracket.barColor, borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        <div style={{ fontSize: 13, color: "#6b7684", marginTop: 8 }}>{today.monthStatus}</div>
      </Card>

      {/* 4) 숫자로 보기 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🧾 숫자로 보기</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat k="1회 운동 단가" v={`${wonN(s.unit)}원/회`} />
          {s.rate >= 100 ? (
            <Stat k="초과 회수액" v={`+${won(s.over)}`} color={today.bracket.barColor} />
          ) : (
            <Stat k="누적 기부액" v={won(s.donate)} color="#f04452" />
          )}
        </div>
      </Card>

      {/* 5) 로그인 전용: 등급 / 스트릭 / 포인트 (게스트는 잠금 — A가 lock UI) */}
      {state.loggedIn ? (
        <>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🏅 내 등급</p>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "#eef4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {game.title.current.emoji}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>
                  {game.title.current.name}
                </div>
                <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600, marginTop: 2 }}>
                  누적 출석 {game.totalDone}회 · 본전 졸업 {game.monthsGraduated}회
                </div>
              </div>
            </div>
            <div style={{ height: 12, background: "#f2f4f6", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${game.title.progressPct}%`, borderRadius: 999, background: "linear-gradient(90deg,#5DC528,#7de34a)", transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#8b95a1", fontWeight: 600, textAlign: "right" }}>
              {game.title.next
                ? `다음 등급 「${game.title.next.name}」까지 출석 ${game.title.remainingToNext}회`
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
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🔥 나의 연속 방문 기록</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 26 }}>🔥</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>
                  <b style={{ color: "#ff8a00" }}>{game.streak}</b>일 연속 출석 중
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
              <button
                onClick={() => actions.claimMilestone()}
                style={{ width: "100%", marginTop: 12, padding: 13, border: "none", borderRadius: 13, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              >
                🎁 광고보고 포인트 받기 (+{game.claimableMilestone.p}P · {game.claimableMilestone.d}일)
              </button>
            ) : (
              <div style={{ fontSize: 11.5, color: "#ff8a00", fontWeight: 700, marginTop: 10, textAlign: "center" }}>
                🎁 3·7·14·30일 달성마다 광고 보고 포인트 받기
              </div>
            )}
          </Card>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>🪙 출석 포인트</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fff7e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🪙</div>
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
                onClick={() => actions.buyFreeze()}
                disabled={!game.canBuyFreeze}
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: game.canBuyFreeze ? "#5DC528" : "#e5e8eb", color: game.canBuyFreeze ? "#fff" : "#b0b8c1", cursor: game.canBuyFreeze ? "pointer" : "not-allowed", fontFamily: "inherit" }}
              >
                5P로 받기
              </button>
              <button
                onClick={async () => {
                  const r = await actions.watchFreezeAd();
                  if (r.ok) openToast("스트릭 보호권이 생겼어요");
                }}
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: "#191f28", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
              >
                📺 광고 보고 받기
              </button>
            </div>
          </Card>
        </>
      ) : (
        <>
          <LockCard emoji="🏅" title="내 등급" desc="출석할수록 등급 상승 — 작심삼일러 → 회수 전문가 → 뽕 뽑기 달인 → 명예 헬창" onLogin={onOpenLogin} />
          <LockCard emoji="🔥" title="연속 출석 스트릭" desc="로그인하면 연속 출석 + 광고 보고 마일스톤 포인트를 받아요" onLogin={onOpenLogin} />
          <LockCard emoji="💰" title="출석 포인트" desc="출석마다 1P 적립 → 스트릭 보호권으로 연속 기록을 지켜요" onLogin={onOpenLogin} />
        </>
      )}

      {/* 6) 회원님께 한마디 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", margin: "0 0 12px" }}>💬 회원님께 한마디</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#4e5968", fontSize: 13.5, lineHeight: 1.7 }}>
          {today.captions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #f2f4f6", borderRadius: 14, padding: 13 }}>
      <div style={{ fontSize: 12, color: "#8b95a1", fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? "#191f28" }}>{v}</div>
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
