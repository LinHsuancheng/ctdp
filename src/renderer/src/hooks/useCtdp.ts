import { useEffect, useState } from "react";
import type { Action, CtdpState } from "../../../shared/ctdp";

/** Live state from the main process. */
export function useCtdpState(): CtdpState | null {
  const [state, setState] = useState<CtdpState | null>(null);
  useEffect(() => {
    let alive = true;
    void window.ctdp.getState().then((s) => alive && setState(s));
    const off = window.ctdp.onState(setState);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

/** Re-renders on an interval so countdowns move. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const dispatch = (action: Action) => window.ctdp.dispatch(action);
