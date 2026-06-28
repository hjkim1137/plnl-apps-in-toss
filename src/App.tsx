import { useState } from "react";

import { usePlnl } from "./hooks/usePlnl";
import { NOTIFY_COPY } from "./lib/content";
import { isInsideTossApp } from "./lib/environment";
import { TodayScreen } from "./screens/TodayScreen";
import { MonthlyScreen } from "./screens/MonthlyScreen";

// App 셸 — 환경 가드 + 탭 전환 + 로그인 배선.
// 화면 상세(TDS 컴포넌트, 버텀시트, 광고 오버레이 등)는 인정(A) 담당.
// 여기서는 usePlnl() 로직을 각 화면에 연결만 한다.

export default function App() {
  const plnl = usePlnl();
  const [tab, setTab] = useState<"today" | "monthly">("today");
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const openLogin = () => setShowLoginSheet(true);
  const closeLogin = () => setShowLoginSheet(false);
  // 앱인토스 웹뷰는 async 이벤트 핸들러에서 토스 SDK 호출(appLogin 등)을 막는다 →
  // sync 핸들러로 login() 을 동기 호출하고, 완료 후 .then 으로 시트만 닫는다.
  const doLogin = () => {
    plnl.actions.login().then(() => closeLogin());
  };

  if (!isInsideTossApp()) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#4e5968" }}>
        <p style={{ fontSize: 18, fontWeight: 800 }}>토스 앱에서 열어주세요</p>
        <p style={{ fontSize: 14 }}>
          이 미니앱은 토스 앱 안에서만 정상 동작해요.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      {/* 상단 바 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 18px",
          background: "#fff",
          borderBottom: "1px solid #f2f4f6",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <img src="/logo.png" alt="뺄래낼래 로고" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          뺄래 <span style={{ color: "#5DC528" }}>낼래</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* 로그인 완료 시에는 숨김 — 비로그인일 때만 로그인 버튼 노출 */}
          {!plnl.state.loggedIn && (
            <button
              onClick={() => plnl.actions.login()}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "6px 12px",
                borderRadius: 999,
                border: "none",
                background: "#5DC528",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              로그인
            </button>
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            aria-label="설정"
            style={{
              border: "none",
              background: "#f2f4f6",
              width: 34,
              height: 34,
              borderRadius: 10,
              fontSize: 16,
            }}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* 설정 (⚙️ 토글) */}
      {showSettings && (
        <div style={{ padding: "12px 18px 0" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "18px 18px 14px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
            <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#6b7684" }}>⚙️ 내 운동 설정</p>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4e5968", display: "block", marginBottom: 7 }}>
                운동 비용 <span style={{ color: "#b0b8c1", fontWeight: 500 }}>(한 달 기준)</span>
              </span>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  defaultValue={plnl.state.fee}
                  inputMode="numeric"
                  onChange={(e) => plnl.actions.setSettings({ fee: Number(e.target.value) })}
                  style={{
                    width: "100%", border: "none", background: "#f2f4f6", borderRadius: 12,
                    padding: "13px 40px 13px 14px", fontSize: 16, fontWeight: 700,
                    color: "#333d4b", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.target.style.background = "#edfadf"; e.target.style.outline = "2px solid #5DC528"; }}
                  onBlur={(e) => { e.target.style.background = "#f2f4f6"; e.target.style.outline = "none"; }}
                />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#8b95a1", fontSize: 14, fontWeight: 600 }}>원</span>
              </div>
            </label>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4e5968", display: "block", marginBottom: 7 }}>
                이번 달 목표 운동 횟수 <span style={{ color: "#b0b8c1", fontWeight: 500 }}>(주3회 ≈ 월12회)</span>
              </span>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  defaultValue={plnl.state.target}
                  inputMode="numeric"
                  onChange={(e) => plnl.actions.setSettings({ target: Number(e.target.value) })}
                  style={{
                    width: "100%", border: "none", background: "#f2f4f6", borderRadius: 12,
                    padding: "13px 40px 13px 14px", fontSize: 16, fontWeight: 700,
                    color: "#333d4b", outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.target.style.background = "#edfadf"; e.target.style.outline = "2px solid #5DC528"; }}
                  onBlur={(e) => { e.target.style.background = "#f2f4f6"; e.target.style.outline = "none"; }}
                />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#8b95a1", fontSize: 14, fontWeight: 600 }}>회</span>
              </div>
              <p style={{ fontSize: 11.5, color: "#b0b8c1", margin: "6px 0 0", lineHeight: 1.4 }}>
                방문 횟수는 <b style={{ color: "#8b95a1" }}>월간 현황</b> 달력의 출석 체크로 자동 집계돼요.
              </p>
            </label>

            <button
              onClick={() => setShowSettings(false)}
              style={{ width: "100%", border: "none", background: "#5DC528", color: "#fff", fontSize: 16, fontWeight: 800, padding: 15, borderRadius: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* 온보딩 — 처음 쓰는 유저 (출석 기록 없음 + 무료 미사용) */}
      {Object.keys(plnl.state.logs).length === 0 && plnl.state.freeUsed === 0 && !showSettings && (
        <div style={{ padding: "12px 18px 0" }}>
          <div style={{
            background: "linear-gradient(135deg, #edfadf, #d4f5b8)",
            border: "1px solid #c5f0a0",
            borderRadius: 18, padding: "18px 18px 16px",
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>👋</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#2d6a0a", marginBottom: 6, letterSpacing: -0.3 }}>
              뺄래 낼래에 오신 걸 환영해요!
            </div>
            <div style={{ fontSize: 13, color: "#3a8a12", lineHeight: 1.6, marginBottom: 14 }}>
              운동 안 가면 그냥 헬스장에 기부하는 셈이에요.<br />
              매달 낸 돈 얼마나 회수하는지 같이 확인해봐요 💪
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2d6a0a", marginBottom: 10 }}>
              먼저 내 운동 비용과 목표 횟수를 설정해주세요 👇
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{ width: "100%", border: "none", background: "#5DC528", color: "#fff", fontSize: 14, fontWeight: 800, padding: "13px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              ⚙️ 운동 설정 시작하기
            </button>
          </div>
        </div>
      )}

      {/* 월말 도착 알림 (F17 트리거) — 새 달에 처음 열면 직전 달 결산/표창장 도착.
          상세 UI 는 인정(A) 담당, 여기선 트리거 배선만. */}
      {plnl.notif.arrival && (
        <div style={{ padding: "12px 18px 0" }}>
          <div
            style={{
              background: "linear-gradient(135deg,#fff3d6,#ffe7a8)",
              border: "1px solid #ffdb87",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: "#8a5b00" }}>
                {NOTIFY_COPY.arrivalTitle(plnl.notif.arrival.monthLabel)}
              </div>
              <button
                onClick={() => plnl.actions.dismissArrival()}
                aria-label="닫기"
                style={{ border: "none", background: "transparent", color: "#b07a00", fontSize: 16, fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => {
                  setTab("monthly");
                  plnl.actions.openArrival();
                }}
                style={{ flex: 1, padding: 10, border: "none", borderRadius: 10, fontWeight: 800, background: "#b07a00", color: "#fff", fontSize: 12.5 }}
              >
                {NOTIFY_COPY.arrivalCta}
              </button>
              {plnl.notif.canPrompt && (
                <button
                  onClick={() => plnl.actions.enableNotifications()}
                  style={{ flex: 1, padding: 10, border: "1px solid #ffdb87", borderRadius: 10, fontWeight: 800, background: "#fff", color: "#b07a00", fontSize: 12.5 }}
                >
                  {NOTIFY_COPY.enableCta}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ padding: "10px 18px 0" }}>
        <nav style={{ display: "flex", gap: 4, background: "#f2f4f6", padding: 4, borderRadius: 13 }}>
          {(["today", "monthly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 4px",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                fontFamily: "inherit",
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#191f28" : "#6b7684",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                transition: "background .15s, color .15s",
              }}
            >
              {t === "today" ? "오늘" : "월간 현황"}
            </button>
          ))}
        </nav>
      </div>

      <main style={{ padding: "14px 18px 40px" }}>
        {tab === "today" ? (
          <TodayScreen plnl={plnl} onOpenLogin={openLogin} />
        ) : (
          <MonthlyScreen plnl={plnl} onOpenLogin={openLogin} />
        )}
      </main>

      {/* 로그인 버텀시트 */}
      {showLoginSheet && (
        <>
          {/* 딤 배경 */}
          <div
            onClick={closeLogin}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 20,
            }}
          />
          {/* 시트 */}
          <div
            style={{
              position: "fixed", left: 0, right: 0, bottom: 0,
              background: "#fff", borderRadius: "24px 24px 0 0",
              padding: "10px 22px 36px", zIndex: 21,
              maxWidth: 480, margin: "0 auto",
            }}
          >
            {/* 핸들 */}
            <div style={{ width: 40, height: 4, background: "#e5e8eb", borderRadius: 999, margin: "6px auto 18px" }} />
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.4 }}>
              토스 로그인하고 더 누리기
            </h3>
            <p style={{ fontSize: 13, color: "#6b7684", lineHeight: 1.55, marginBottom: 18 }}>
              기기를 바꿔도 출석 기록이 그대로 남고, 광고 없이 무제한으로 쓸 수 있어요.
            </p>
            {[
              { e: "📱", t: "기기 바꿔도 기록 그대로", s: "출석·스트릭·포인트가 토스 계정에 안전하게 저장돼요" },
              { e: "🚫", t: "광고 없이 무제한 출석 체크", s: "매일 광고 안 보고 바로 기록" },
              { e: "🪙", t: "출석할 때마다 포인트 적립", s: "모은 포인트로 스트릭 보호권 교환" },
              { e: "🏅", t: "월간 결산 & 표창장", s: "한 달이 끝나면 나만의 표창장이 도착해요" },
            ].map((b) => (
              <div key={b.t} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "10px 0" }}>
                <div style={{ fontSize: 20, width: 24, textAlign: "center" }}>{b.e}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#333d4b" }}>{b.t}</div>
                  <div style={{ fontSize: 12, color: "#8b95a1", marginTop: 1 }}>{b.s}</div>
                </div>
              </div>
            ))}
            <button
              onClick={doLogin}
              style={{ width: "100%", border: "none", background: "#5DC528", color: "#fff", fontSize: 16, fontWeight: 800, padding: 16, borderRadius: 14, marginTop: 18 }}
            >
              토스로 3초 만에 로그인
            </button>
            <div
              onClick={closeLogin}
              style={{ textAlign: "center", fontSize: 13, color: "#b0b8c1", marginTop: 12, cursor: "pointer", fontWeight: 600 }}
            >
              다음에 할게요
            </div>
          </div>
        </>
      )}
    </div>
  );
}
