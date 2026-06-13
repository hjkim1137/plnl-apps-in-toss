import { useState } from "react";

import { usePlnl } from "./hooks/usePlnl";
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
    <div>
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
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          뺄래 <span style={{ color: "#3182f6" }}>낼래</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {plnl.state.loggedIn ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: "5px 10px",
                borderRadius: 999,
                background: "#e8f3ff",
                color: "#3182f6",
              }}
            >
              토스 로그인
            </span>
          ) : (
            <button
              onClick={() => plnl.actions.login()}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "6px 12px",
                borderRadius: 999,
                border: "none",
                background: "#3182f6",
                color: "#fff",
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
        <section style={{ padding: "14px 18px", background: "#fff" }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
            운동 비용(한 달)
            <input
              type="number"
              defaultValue={plnl.state.fee}
              onChange={(e) =>
                plnl.actions.setSettings({ fee: Number(e.target.value) })
              }
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </label>
          <label style={{ display: "block", fontSize: 13 }}>
            이번 달 목표 횟수
            <input
              type="number"
              defaultValue={plnl.state.target}
              onChange={(e) =>
                plnl.actions.setSettings({ target: Number(e.target.value) })
              }
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </label>
        </section>
      )}

      {/* 탭 */}
      <nav style={{ display: "flex", gap: 4, padding: "10px 18px 0" }}>
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
              background: tab === t ? "#fff" : "#f2f4f6",
              color: tab === t ? "#191f28" : "#6b7684",
              boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}
          >
            {t === "today" ? "오늘" : "월간 현황"}
          </button>
        ))}
      </nav>

      <main style={{ padding: "14px 18px 40px" }}>
        {tab === "today" ? (
          <TodayScreen plnl={plnl} />
        ) : (
          <MonthlyScreen plnl={plnl} />
        )}
      </main>
    </div>
  );
}
