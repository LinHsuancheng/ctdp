import { globalShortcut } from "electron";
import type { Settings } from "../shared/ctdp";

/** Global hotkeys: the reserve hotkey is the “signal”, the start hotkey is sitting down. */
export class Shortcuts {
  private applied = "";

  constructor(private readonly handlers: { reserve(): void; start(): void }) {}

  apply(settings: Settings): void {
    const key = `${settings.reserveShortcut}|${settings.startShortcut}`;
    if (key === this.applied) return;
    this.applied = key;
    globalShortcut.unregisterAll();
    this.register(settings.reserveShortcut, this.handlers.reserve);
    this.register(settings.startShortcut, this.handlers.start);
  }

  private register(accelerator: string, handler: () => void): void {
    try {
      if (!globalShortcut.register(accelerator, handler)) {
        console.warn(`shortcut ${accelerator} is taken by another app`);
      }
    } catch (err) {
      console.warn(`invalid shortcut ${accelerator}:`, err);
    }
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }
}
