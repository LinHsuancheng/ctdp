import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_DEVICE_SETTINGS, type Action, type CtdpState, type DeviceSettings } from "../../../shared/ctdp";
import type { SyncView } from "../../../shared/ipc";

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

/** Live preferences of this device from the main process. */
export function useDeviceSettings(): DeviceSettings | null {
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  useEffect(() => {
    let alive = true;
    void window.ctdp.getSettings().then((s) => alive && setSettings(s));
    const off = window.ctdp.onSettings(setSettings);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return settings;
}

/** Sync status and merge results. */
export function useSync(): SyncView | null {
  const [view, setView] = useState<SyncView | null>(null);
  useEffect(() => {
    let alive = true;
    void window.ctdp.getSync().then((v) => alive && setView(v));
    const off = window.ctdp.onSync(setView);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return view;
}

export const SettingsContext = createContext<DeviceSettings>(DEFAULT_DEVICE_SETTINGS);
export const useSettings = () => useContext(SettingsContext);

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
