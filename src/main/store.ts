import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { defaultState, migrate, type CtdpState } from "../shared/ctdp";

const stateFile = () => join(app.getPath("userData"), "ctdp-state.json");

export function loadState(): CtdpState {
  const file = stateFile();
  if (!existsSync(file)) return defaultState();
  try {
    return migrate(JSON.parse(readFileSync(file, "utf8")));
  } catch (err) {
    // Keep the unreadable file for inspection instead of overwriting it.
    const backup = `${file}.corrupt-${Date.now()}`;
    renameSync(file, backup);
    console.error(`state file unreadable, moved to ${backup}:`, err);
    return defaultState();
  }
}

/** Write-then-rename so a crash never leaves a half-written file. */
export function saveState(state: CtdpState): void {
  const file = stateFile();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, file);
}
