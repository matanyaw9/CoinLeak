import type { CoinLeakBridge } from "@shared/ipc";

declare global {
  interface Window {
    coinleak: CoinLeakBridge;
  }
}

export {};
