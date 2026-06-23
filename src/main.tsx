import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { Component, StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import config from "../granite.config.ts";
import App from "./App.tsx";
import "./index.css";

class ProviderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.children : (
      <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
        {this.props.children}
      </TDSMobileAITProvider>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProviderBoundary>
      <App />
    </ProviderBoundary>
  </StrictMode>,
);
