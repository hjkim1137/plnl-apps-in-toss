import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "plnl",
  brand: {
    displayName: "뺄래 낼래",
    primaryColor: "#3182f6",
    // 토스 콘솔이 발급한 정적 CDN URL. 콘솔에 업로드한 아이콘과 동일해야 검수 통과.
    // 콘솔에서 아이콘을 교체하면 새 URL 받아서 여기 갱신할 것.
    // TODO(검수): 콘솔에 아이콘 업로드 후 발급된 static.toss.im URL 로 교체.
    icon: "",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
