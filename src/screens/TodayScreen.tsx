import type { PlnlController } from "../hooks/usePlnl";
import {
  AD_UNLOCKED_TAG,
  freeCheckinTagText,
  todayCheckInStatusText,
} from "../lib/content";
import { won, wonN } from "../lib/format";

// ── 오늘 탭 ──────────────────────────────────────────────────────────────
// TODO(인정/A): 아래 plain DOM 을 TDS 컴포넌트로 교체. 데이터/액션은 plnl 에서 그대로 사용.
// 이 파일은 usePlnl 가 노출하는 값의 "살아있는 스펙" 이기도 함.

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      }}
    >
      {children}
    </div>
  );
}

export function TodayScreen({ plnl }: { plnl: PlnlController }) {
  const { today, checkin, game, actions, state } = plnl;
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
        <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>
          🔔 오늘의 선택{" "}
          {!state.loggedIn && (
            <small style={{ color: "#8b95a1" }}>
              · 무료 {checkin.freeLeft}/3
            </small>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "#e8f3ff", borderRadius: 14, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#3182f6", fontWeight: 700 }}>오늘 가면</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#3182f6" }}>
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
          <div style={{ fontSize: 12, fontWeight: 700, color: state.adUnlocked ? "#15b877" : "#3182f6", textAlign: "center", marginBottom: 10 }}>
            {freeTag}
          </div>
        )}

        {checkin.mode === "buttons" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => actions.checkIn("done")}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: today.todayValue === "done" ? "#15b877" : "#3182f6", color: "#fff" }}
            >
              오늘 갔어요 💪
            </button>
            <button
              onClick={() => actions.checkIn("missed")}
              style={{ flex: 1, padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: today.todayValue === "missed" ? "#f04452" : "#f2f4f6", color: today.todayValue === "missed" ? "#fff" : "#4e5968" }}
            >
              오늘 안 갔어요
            </button>
          </div>
        ) : (
          // 무료 소진 → 전면형 광고 게이트. 시청 완료 시 1회 언락되고 위 버튼이 나타남.
          <button
            onClick={() => actions.watchCheckinAd()}
            style={{ width: "100%", padding: 15, border: "none", borderRadius: 14, fontWeight: 800, background: "#191f28", color: "#fff" }}
          >
            📺 짧은 광고 보고 출석 체크하기
          </button>
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
        <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>📅 {today.monthLabel} 회수율</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: today.bracket.barColor }}>{s.rate}</div>
          <div style={{ fontSize: 15, color: "#8b95a1", fontWeight: 700 }}>% 회수</div>
        </div>
        <div style={{ height: 14, background: "#f2f4f6", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
          <div style={{ height: "100%", width: `${Math.min(100, s.rateRaw)}%`, background: today.bracket.barColor }} />
        </div>
        <div style={{ fontSize: 13, color: "#6b7684", marginTop: 8 }}>{today.monthStatus}</div>
      </Card>

      {/* 4) 숫자로 보기 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🧾 숫자로 보기</p>
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
            <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🏅 내 등급</p>
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
              <div style={{ height: "100%", width: `${game.title.progressPct}%`, borderRadius: 999, background: "linear-gradient(90deg,#3182f6,#5a9cff)", transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#8b95a1", fontWeight: 600, textAlign: "right" }}>
              {game.title.next
                ? `다음 등급 「${game.title.next.name}」까지 출석 ${game.title.remainingToNext}회`
                : "최고 등급 달성! 👑"}
            </div>
          </Card>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🔥 연속 출석</p>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              <b style={{ color: "#ff8a00" }}>{game.streak}</b>일 연속
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {game.milestoneChips.map((c) => (
                <span key={c.d} style={{ flex: 1, textAlign: "center", borderRadius: 10, padding: "7px 2px", fontSize: 11, fontWeight: 800, background: c.status === "got" ? "#fff3d6" : c.status === "ready" ? "#ffe7a8" : "#f2f4f6", color: c.status === "locked" ? "#b0b8c1" : "#b07a00" }}>
                  {c.d}일<br />{c.status === "got" ? "받음" : `+${c.p}P`}
                </span>
              ))}
            </div>
            {game.claimableMilestone && (
              <button
                onClick={() => actions.claimMilestone()}
                style={{ width: "100%", marginTop: 12, padding: 13, border: "none", borderRadius: 13, fontWeight: 800, background: "#191f28", color: "#fff" }}
              >
                🎁 광고보고 포인트 받기 (+{game.claimableMilestone.p}P · {game.claimableMilestone.d}일)
              </button>
            )}
          </Card>
          <Card>
            <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🪙 출석 포인트</p>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              <b style={{ color: "#ffb800" }}>{game.points}</b> P
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              🛡️ 스트릭 보호권 보유 {game.freezes}개
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => actions.buyFreeze()}
                disabled={!game.canBuyFreeze}
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: game.canBuyFreeze ? "#3182f6" : "#e5e8eb", color: game.canBuyFreeze ? "#fff" : "#b0b8c1" }}
              >
                5P로 받기
              </button>
              <button
                onClick={() => actions.watchFreezeAd()}
                style={{ flex: 1, padding: 9, border: "none", borderRadius: 10, fontWeight: 800, background: "#191f28", color: "#fff" }}
              >
                📺 광고 보고 받기
              </button>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>🔒 로그인 전용</p>
          <p style={{ fontSize: 13, color: "#8b95a1", margin: 0 }}>
            로그인하면 등급·연속 출석·포인트·표창장이 열려요.
            {/* TODO(A): 자물쇠+블러 잠금 카드 + 로그인 버텀시트 트리거 */}
          </p>
          <button
            onClick={() => actions.login()}
            style={{ marginTop: 10, padding: "9px 16px", border: "none", borderRadius: 999, fontWeight: 800, background: "#3182f6", color: "#fff" }}
          >
            토스 로그인하기
          </button>
        </Card>
      )}

      {/* 6) 회원님께 한마디 */}
      <Card>
        <p style={{ fontWeight: 700, color: "#6b7684", marginTop: 0 }}>💬 회원님께 한마디</p>
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
