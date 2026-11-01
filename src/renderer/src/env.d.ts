import type { CtdpApi } from "../../shared/ipc";

declare global {
  interface Window {
    ctdp: CtdpApi;
  }
}

export {};
