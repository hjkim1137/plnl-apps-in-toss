import { useState, type CSSProperties, type ReactNode } from "react";

interface AdButtonProps {
  /** 광고 실행 액션. usePlnl 액션 규약상 throw 없이 {ok} 를 resolve 한다. */
  onRun: () => Promise<{ ok: boolean }>;
  /** 완료(성공/실패) 후 콜백 — 토스트 등. */
  onDone?: (r: { ok: boolean }) => void;
  /** 평상시 라벨. */
  children: ReactNode;
  /** 로딩 중 라벨. 빈 문자열이면 스피너만 표시(좁은 버튼용). 기본 '광고 불러오는 중…'. */
  loadingLabel?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

/**
 * 리워드/전면형 광고 실행 버튼 — 클릭 즉시 스피너로 전환하고 광고 종료까지 중복 클릭을 막는다.
 * 앱인토스 웹뷰는 async 이벤트 핸들러에서 토스 SDK(광고) 호출을 막으므로, 핸들러는 sync 로
 * 두고 onRun().then() 으로 처리한다. 스피너 색은 버튼 글자색(currentColor)을 따른다.
 */
export function AdButton({
  onRun,
  onDone,
  children,
  loadingLabel = "광고 불러오는 중…",
  style,
  disabled,
}: AdButtonProps) {
  const [loading, setLoading] = useState(false);
  const handle = () => {
    if (loading || disabled) return;
    setLoading(true);
    onRun().then((r) => {
      setLoading(false);
      onDone?.(r);
    });
  };
  return (
    <button
      onClick={handle}
      disabled={loading || disabled}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: loading ? 0.92 : style?.opacity ?? 1,
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              flexShrink: 0,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              display: "inline-block",
              animation: "plnl-spin 0.7s linear infinite",
            }}
          />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
