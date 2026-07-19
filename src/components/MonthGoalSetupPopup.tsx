import { useState } from "react";
import { generateHapticFeedback } from "@apps-in-toss/web-bridge";

import type { PlnlController } from "../hooks/usePlnl";
import { PopupShell } from "./PopupShell";

// 월초 목표 세팅 팝업 (item 6). 달이 바뀌었는데 이번 달 인증 기록이 없으면 노출.
// 디폴트는 지난 달(현재) 세팅값 — "이대로 시작"하면 확정+잠금(그 달엔 수정 불가, item 5).
// 딤 탭으로 안 닫힘(명시 버튼만). "나중에"는 이번 세션만 닫음(재진입 시 다시 뜸).

export function MonthGoalSetupPopup({
  plnl,
  onDismiss,
}: {
  plnl: PlnlController;
  onDismiss: () => void;
}) {
  const { monthGoal, actions } = plnl;
  const [fee, setFee] = useState(monthGoal.defaultFee);
  const [weeklyTarget, setWeeklyTarget] = useState(monthGoal.defaultWeeklyTarget);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    background: "#f2f4f6",
    borderRadius: 12,
    padding: "13px 40px 13px 14px",
    fontSize: 16,
    fontWeight: 700,
    color: "#333d4b",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <PopupShell>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: "#191f28" }}>
        이번 달 운동 목표를 정해요
      </h2>
      <p style={{ margin: "10px 0 20px", fontSize: 13.5, color: "#6b7684", lineHeight: 1.6 }}>
        지난 달 설정을 그대로 불러왔어요.
        <br />
        <b style={{ color: "#8b95a1" }}>확정하면 이번 달 동안은 바꿀 수 없어요.</b>
      </p>

      <label style={{ display: "block", marginBottom: 12, textAlign: "left" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4e5968", display: "block", marginBottom: 6 }}>
          운동 비용 <span style={{ color: "#b0b8c1", fontWeight: 500 }}>(한 달 기준)</span>
        </span>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            inputMode="numeric"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            style={inputStyle}
          />
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#8b95a1", fontSize: 14, fontWeight: 600 }}>원</span>
        </div>
      </label>

      <label style={{ display: "block", marginBottom: 22, textAlign: "left" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4e5968", display: "block", marginBottom: 6 }}>
          이번 주 목표 운동 횟수
        </span>
        <div role="radiogroup" aria-label="이번 주 목표 운동 횟수" style={{ display: "flex", gap: 8 }}>
          {[2, 3, 4, 5].map((n) => {
            const active = weeklyTarget === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setWeeklyTarget(n)}
                style={{
                  flex: 1,
                  border: active ? "2px solid #5DC528" : "2px solid transparent",
                  background: active ? "#edfadf" : "#f2f4f6",
                  borderRadius: 12,
                  padding: "12px 0",
                  fontSize: 15,
                  fontWeight: 700,
                  color: active ? "#3d9c1a" : "#333d4b",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {n}회
              </button>
            );
          })}
        </div>
      </label>

      <button
        onClick={() => {
          generateHapticFeedback({ type: "success" });
          actions.confirmMonthGoal({ fee, weeklyTarget }); // 값 저장 + 이번 달 잠금
        }}
        style={{
          width: "100%",
          padding: 15,
          border: "none",
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 15,
          background: "#5DC528",
          color: "#fff",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        이 목표로 시작하기
      </button>
      <div
        onClick={() => {
          generateHapticFeedback({ type: "tap" });
          onDismiss();
        }}
        style={{ textAlign: "center", fontSize: 13, color: "#b0b8c1", marginTop: 12, cursor: "pointer", fontWeight: 600 }}
      >
        나중에
      </div>
    </PopupShell>
  );
}
