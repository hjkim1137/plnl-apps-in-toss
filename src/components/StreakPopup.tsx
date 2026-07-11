import { generateHapticFeedback } from "@apps-in-toss/web-bridge";
import { useToast } from "@toss/tds-mobile";

import { STREAK_POPUP_COPY } from "../lib/content";
import type { PlnlController } from "../hooks/usePlnl";
import { AdButton } from "./AdButton";
import { PopupShell } from "./PopupShell";

// 스트릭 상태 팝업 (기획 §2·§3). usePlnl 이 감지한 plnl.streakPopup 을 중앙 모달로 띄운다.
// milestone(3·7·14·30일 달성 → 보상 수령) · broken(끊김 → 재시작). 어느 쪽으로 닫든
// dismissStreakPopup 이 노출 마커를 기록한다. 확인 버튼은 강한 햅틱(success), 딤 탭은 약한 tap.

export function StreakPopup({ plnl }: { plnl: PlnlController }) {
  const { streakPopup, game, actions } = plnl;
  const { openToast } = useToast();

  if (streakPopup == null) return null;

  const dismiss = (strong: boolean) => {
    generateHapticFeedback({ type: strong ? "success" : "tap" });
    actions.dismissStreakPopup();
  };

  // 보상의 날에 지급될 포인트(수령 후엔 null 이 되므로 지금 캡처).
  const rewardP = game.claimableMilestone?.p ?? null;

  let label = "";
  let title = "";
  let ctaLabel = ""; // 기본: close 버튼. reward 변형만 rewardCta 로 덮는다.
  let rewardCta: React.ReactNode = null;

  if (streakPopup.kind === "milestone") {
    // 마일스톤 달성 → 보상 수령(광고). 라벨 "연속 인증 N일차" + 마일스톤 서클 + 출석 보상 받기.
    label = STREAK_POPUP_COPY.label(streakPopup.streak);
    title = STREAK_POPUP_COPY.milestone.title;
    if (game.claimableMilestone) {
      rewardCta = (
        <AdButton
          onRun={() => {
            generateHapticFeedback({ type: "tap" });
            return actions.claimMilestone();
          }}
          onDone={(r) => {
            if (r.ok) {
              generateHapticFeedback({ type: "success" });
              if (rewardP != null) openToast(`+${rewardP}P 받았어요`);
              actions.dismissStreakPopup();
            }
            // 실패(광고 미완료) 시 팝업 유지 — 재시도하거나 딤 탭으로 닫을 수 있음
          }}
          style={ctaStyle}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span>🎁</span>
            <span>{STREAK_POPUP_COPY.milestone.cta}</span>
          </span>
        </AdButton>
      );
    } else {
      ctaLabel = "확인"; // 방어: 렌더 시점에 이미 수령됨(거의 없음) → 닫기
    }
  } else {
    // 끊김 → 재시작 격려. milestone 과 동일 구조(라벨 "연속 인증 1일차" + 마일스톤 서클 + 확인).
    label = STREAK_POPUP_COPY.label(1);
    title = STREAK_POPUP_COPY.broken.title;
    ctaLabel = STREAK_POPUP_COPY.broken.cta;
  }

  return (
    <PopupShell onDimClick={() => dismiss(false)}>
      {label && (
        <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#8b95a1" }}>
          {label}
        </p>
      )}
      <h2
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: -0.5,
          lineHeight: 1.3,
          color: "#191f28",
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </h2>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "22px 0 24px" }}>
        {game.milestoneChips.map((c) => (
          <MilestoneCircle key={c.d} day={c.d} status={c.status} />
        ))}
      </div>

      <div>
        {rewardCta ?? (
          <button onClick={() => dismiss(true)} style={ctaStyle}>
            {ctaLabel}
          </button>
        )}
      </div>
    </PopupShell>
  );
}

// 마일스톤 서클. 모두 체크(✓) 표시 — 상태는 색으로 구분(got=초록 / ready=노랑 강조 / locked=회색).
function MilestoneCircle({
  day,
  status,
}: {
  day: number;
  status: "got" | "ready" | "locked";
}) {
  const bg = status === "got" ? "#e6f7e0" : status === "ready" ? "#ffe7a8" : "#f2f4f6";
  const faceColor = status === "got" ? "#3a8a12" : status === "locked" ? "#c4cdd6" : "#b07a00";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 800,
          color: faceColor,
          opacity: status === "locked" ? 0.55 : 1,
          border: status === "ready" ? "2px solid #ffc93c" : "none",
        }}
      >
        ✓
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 800,
          color: status === "locked" ? "#b0b8c1" : "#4e5968",
        }}
      >
        {day}일
      </span>
    </div>
  );
}

const ctaStyle: React.CSSProperties = {
  width: "100%",
  padding: 15,
  border: "none",
  borderRadius: 14,
  fontWeight: 800,
  fontSize: 15,
  background: "#191f28",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
};
