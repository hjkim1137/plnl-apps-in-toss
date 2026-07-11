// 중앙 모달 셸 — 딤 + 카드. StreakPopup·FreezeRepairPopup 이 공유한다.
// onDimClick 을 안 주면 딤 탭으로 안 닫힘(중요 결정은 명시 버튼만 허용).

export function PopupShell({
  onDimClick,
  children,
}: {
  onDimClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        onClick={onDimClick}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 30 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(340px, calc(100vw - 48px))",
          background: "#fff",
          borderRadius: 24,
          padding: "28px 22px 22px",
          zIndex: 31,
          textAlign: "center",
          boxShadow: "0 12px 40px rgba(0,0,0,.2)",
        }}
      >
        {children}
      </div>
    </>
  );
}
