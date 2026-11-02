import { globalShortcut } from "electron";
import type { DeviceSettings } from "../shared/ctdp";
import type { ShortcutStatus } from "../shared/ipc";

function tryRegister(accelerator: string, handler: () => void): ShortcutStatus {
  try {
    if (globalShortcut.register(accelerator, handler)) return { accelerator, ok: true, message: "Works" };
    return { accelerator, ok: false, message: "Taken by another app" };
  } catch {
    return { accelerator, ok: false, message: "Not a valid shortcut" };
  }
}

/** One global shortcut that brings up the CTDP window from anywhere. */
export class Shortcuts {
  private applied: string | null = null;
  private current: ShortcutStatus = { accelerator: "", ok: false, message: "Not set" };

  constructor(private readonly summon: () => void) {}

  apply(settings: DeviceSettings): void {
    if (settings.summonShortcut === this.applied) return;
    this.applied = settings.summonShortcut;
    globalShortcut.unregisterAll();
    this.current = tryRegister(settings.summonShortcut, this.summon);
    if (!this.current.ok) console.warn(`shortcut ${settings.summonShortcut}: ${this.current.message}`);
  }

  status(): ShortcutStatus {
    return this.current;
  }

  /** Our own shortcut counts as available; anything else is registered for a moment to see. */
  test(accelerator: string): ShortcutStatus {
    if (accelerator === this.current.accelerator && this.current.ok) return this.current;
    const result = tryRegister(accelerator, () => {});
    if (result.ok) globalShortcut.unregister(accelerator);
    return result;
  }

  dispose(): void {
    globalShortcut.unregisterAll();
  }
}
