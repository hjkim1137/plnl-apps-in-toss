import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 실기기 토스 샌드박스 앱이 같은 Wi-Fi 망의 Mac dev 서버에 접근할 수 있도록 모든
    // 인터페이스에서 listen. 미설정 시 localhost(127.0.0.1) 만 열려 iPhone 에서 연결 불가.
    host: true,
    port: 5173,
    // strictPort=true 면 5173 점유 중일 때 자동으로 다른 포트로 fallback 안 함. 샌드박스에
    // 입력한 5173 과 어긋나는 사고 방지.
    strictPort: true,
  },
});
