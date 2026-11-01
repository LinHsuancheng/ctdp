import type { Action, CtdpState } from "./ctdp/types";

export const IPC = {
  getState: "ctdp:get-state",
  dispatch: "ctdp:dispatch",
  state: "ctdp:state",
  openMain: "ctdp:open-main",
  hideMini: "ctdp:hide-mini",
} as const;

/** What the preload exposes to renderers as window.ctdp. */
export interface CtdpApi {
  getState(): Promise<CtdpState>;
  dispatch(action: Action): Promise<void>;
  onState(listener: (state: CtdpState) => void): () => void;
  openMain(): void;
  hideMini(): void;
}
