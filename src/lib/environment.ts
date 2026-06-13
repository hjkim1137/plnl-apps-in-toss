// 미니앱 실행 환경 판별. (sajumon 패턴 이식)
//
// 토스 앱의 WebView 내부에서 열리면 `window.ReactNativeWebView` 가 주입됨.
// 외부 브라우저 진입 시 토스 SDK 들(appLogin / getAnonymousKey / 광고 등)이 reject 되어
// 핵심 기능이 동작 안 함.
//
// 정책:
// - **prod 빌드**: WebView 미감지 시 가드 화면 노출
// - **dev 빌드** (`import.meta.env.DEV`): 우회 — 로컬 vite dev 서버에서 mock 흐름 검증

declare global {
  interface Window {
    ReactNativeWebView?: unknown;
  }
}

export function isInsideTossApp(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return true;
  return Boolean(window.ReactNativeWebView);
}
