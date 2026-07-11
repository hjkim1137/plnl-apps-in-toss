import { generateHapticFeedback } from "@apps-in-toss/web-bridge";

import type { PlnlController } from "../hooks/usePlnl";
import { PopupShell } from "./PopupShell";

// 보호권 복구 제안 팝업. 기존엔 '내 인증기록' 카드 안 인라인이었으나 분리 팝업으로 승격.
// 중요 결정이라 딤 탭으로 안 닫힘(명시 버튼만). "지키기"=강한 햅틱(success), "괜찮아요"=약한 tap.

export function FreezeRepairPopup({ plnl }: { plnl: PlnlController }) {
  const { repair, actions } = plnl;
  if (repair == null) return null;

  return (
    <PopupShell>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: "#191f28" }}>
        출석 인증 빠진 날이 있어요
      </h2>
      <p style={{ margin: "12px 0 22px", fontSize: 14, color: "#6b7684", lineHeight: 1.6 }}>
        {repair.count}일 빠졌어요.
        <br />
        보호권 {repair.count}개로 연속 인증을 지킬까요?
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => {
            generateHapticFeedback({ type: "tap" });
            actions.dismissFreezeRepair();
          }}
          style={{
            flex: "0 0 auto",
            padding: "15px 18px",
            border: "1px solid #e5e8eb",
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 15,
            background: "#fff",
            color: "#6b7684",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          괜찮아요
        </button>
        <button
          onClick={() => {
            generateHapticFeedback({ type: "success" });
            actions.confirmFreezeRepair();
          }}
          style={{
            flex: 1,
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
          지키기 (보호권 {repair.count}개)
        </button>
      </div>
    </PopupShell>
  );
}
