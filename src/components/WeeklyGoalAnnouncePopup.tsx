import { generateHapticFeedback } from "@apps-in-toss/web-bridge";

import { WEEKLY_GOAL_ANNOUNCE_COPY } from "../lib/content";
import type { PlnlController } from "../hooks/usePlnl";
import { PopupShell } from "./PopupShell";

// 주간 목표(2~5회 라디오) 신규 기능 안내 팝업. 기존 사용자에게 최초 1회만 노출
// (usePlnl.weeklyGoalAnnounce). 확인 버튼만 닫기 허용 — 공지성 팝업이라 딤 탭으로도 닫히게 둔다.

export function WeeklyGoalAnnouncePopup({ plnl }: { plnl: PlnlController }) {
  const { weeklyGoalAnnounce, actions } = plnl;
  if (!weeklyGoalAnnounce) return null;

  const dismiss = () => {
    generateHapticFeedback({ type: "tap" });
    actions.dismissWeeklyGoalAnnounce();
  };

  return (
    <PopupShell onDimClick={dismiss}>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: -0.4,
          lineHeight: 1.35,
          color: "#191f28",
          whiteSpace: "pre-line",
        }}
      >
        {WEEKLY_GOAL_ANNOUNCE_COPY.title}
      </h2>
      <p style={{ margin: "12px 0 22px", fontSize: 14, color: "#6b7684", lineHeight: 1.6, whiteSpace: "pre-line" }}>
        {WEEKLY_GOAL_ANNOUNCE_COPY.body}
      </p>
      <button
        onClick={dismiss}
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
        {WEEKLY_GOAL_ANNOUNCE_COPY.cta}
      </button>
    </PopupShell>
  );
}
