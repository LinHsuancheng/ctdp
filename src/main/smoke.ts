import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import type { Engine } from "./engine";
import type { SyncClient } from "./sync";
import { existsSync } from "node:fs";
import { defaultState } from "../shared/ctdp";
import { deviceFile, readDataFile, saveData } from "./store";

/**
 * Headless end-to-end check used by scripts/smoke.sh: drives the engine and
 * reads back what both windows render, then exits with a status code.
 */
export const isSmoke = () => process.argv.includes("--smoke");

const LEGACY_SHORTCUT = "CommandOrControl+Alt+F9";

/**
 * Must run before app ready so the check never touches real user data. Starts
 * from a version-2 (single-device) file to exercise the upgrade.
 */
export function prepareSmoke(): void {
  const dir = mkdtempSync(join(tmpdir(), "ctdp-smoke-"));
  app.setPath("userData", dir);
  const v2 = { ...defaultState(), version: 2, settings: { reserveShortcut: LEGACY_SHORTCUT, showMiniWindow: true } };
  writeFileSync(join(dir, "ctdp-state.json"), JSON.stringify(v2));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textOf(win: BrowserWindow, expected: string, timeoutMs = 8000): Promise<string> {
  const until = Date.now() + timeoutMs;
  let text = "";
  while (Date.now() < until) {
    if (!win.webContents.isLoading()) {
      text = await win.webContents.executeJavaScript("document.body.innerText");
      if (text.includes(expected)) return text;
    }
    await delay(200);
  }
  throw new Error(`timed out waiting for "${expected}"; page text was:\n${text}`);
}

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

export async function runSmoke(main: BrowserWindow, mini: BrowserWindow, engine: Engine, sync: SyncClient): Promise<void> {
  try {
    const chainId = engine.get().primaryChainId!;
    await textOf(main, "Desk");
    engine.dispatch({ type: "reserve", chainId });
    await textOf(main, "Reserved");
    engine.dispatch({ type: "seat", chainId, chunkId: "chunk-block", task: "Smoke test", minutes: 0, categoryId: null });
    await textOf(main, "Smoke test");
    check(mini.isVisible(), "mini window should be visible while seated");
    const miniText = await textOf(mini, "Seated");
    const mainText = await textOf(main, "Three-hour block");

    engine.dispatch({ type: "violation", behavior: "Get water", verdict: "allow" });
    const chain = () => engine.get().chains.find((c) => c.id === chainId)!;
    check(chain().main.precedents.length === 1, "precedent not recorded");
    check(chain().auxiliary.counter.current === 1, "reservation should have been kept");
    engine.dispatch({ type: "abandonUnit" });
    check(engine.get().successionPending, "losing the primary chain should ask for a successor");
    await textOf(main, "Primary chain lost");
    await delay(300);
    check(!mini.isVisible(), "mini window should hide when idle");
    await textOf(main, "just lost, restarts from #1");
    engine.dispatch({ type: "saveChain", chainId: null, input: { name: "Fresh", trigger: "Open the notebook", signal: "Clap", windowMin: 15 }, primary: true });
    const fresh = engine.get().chains.find((c) => c.name === "Fresh");
    check(fresh !== undefined && engine.get().primaryChainId === fresh.id, "a new chain should take over as primary");
    check(!engine.get().successionPending, "succession should close after a new primary is chosen");

    const exported = join(app.getPath("userData"), "export.json");
    saveData(engine.getData(), exported);
    const before = engine.getData();
    check(before.log.length > 0 && before.log.every((e) => e.action.type !== "tick"), "effective actions are logged, ticks are not");
    engine.dispatch({ type: "deleteChain", chainId: fresh!.id });
    const imported = readDataFile(exported);
    check(imported !== null && JSON.stringify(imported) === JSON.stringify(before), "export should read back unchanged");
    engine.replace(imported!);
    check(engine.get().chains.some((c) => c.name === "Fresh"), "import should restore the deleted chain");
    check(readDataFile(join(app.getPath("userData"), "missing.json")) === null, "a missing file is not CTDP data");
    check(existsSync(deviceFile()), "the device file should exist");
    check(engine.settings().reserveShortcut === LEGACY_SHORTCUT, "version-2 settings should move to this device");
    check(existsSync(join(app.getPath("userData"), "ctdp-state.json.v2-backup")), "the version-2 file should be backed up");
    main.webContents.executeJavaScript(`[...document.querySelectorAll("nav button, .tabs button")].find((b) => b.textContent === "Settings")?.click()`);
    await textOf(main, "ctdp-state.json");
    await textOf(main, "Show notifications on this device");

    // Sync with the real server started by scripts/smoke.sh.
    const url = process.env.CTDP_SMOKE_SYNC_URL;
    const token = process.env.CTDP_SMOKE_SYNC_TOKEN;
    check(Boolean(url && token), "smoke.sh should start a sync server");
    const connected = await sync.connect(url!, token!);
    check(connected.ok, `connecting to the sync server failed: ${connected.message}`);
    engine.dispatch({ type: "saveCategory", categoryId: null, name: "Synced category" });
    await sync.syncNow();
    const remote = (await (await fetch(`${url}/api/data`, { headers: { authorization: `Bearer ${token}` } })).json()) as {
      entries: { action: { type: string; name?: string } }[];
    };
    check(remote.entries.length === engine.getData().log.length, "the server should hold every log entry");
    check(remote.entries.some((e) => e.action.name === "Synced category"), "a new action should reach the server");
    await textOf(main, "Synced at");

    console.log(`SMOKE OK\n--- mini ---\n${miniText}\n--- main (seated) ---\n${mainText}`);
    app.exit(0);
  } catch (err) {
    console.error("SMOKE FAIL:", err);
    app.exit(1);
  }
}
