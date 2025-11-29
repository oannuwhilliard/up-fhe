import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import "./index.css";
import App from "./App.tsx";
import { config } from "./wagmi.config.ts";

declare global {
  interface Window {
    relayerSDK?: unknown;
  }
}

const queryClient = new QueryClient();

const logRelayerSdk = () => {
  if (window.relayerSDK) {
    console.log("[App] Encryption service loaded");
  } else {
    console.warn("[App] Encryption service script not detected");
  }
};

if (document.readyState === "complete") {
  logRelayerSdk();
} else {
  window.addEventListener("load", logRelayerSdk, { once: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="en-US"
          modalSize="compact"
          initialChain={sepolia}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
