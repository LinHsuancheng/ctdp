import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import type { Engine } from "./engine";

/**
 * Headless end-to-end check used by scripts/smoke.sh: drives the engine and
 * reads back what both windows render, then exits with a status code.
 */
export const isSmoke = () => process.argv.includes("--smoke");

/** Must run before app ready so the check never touches real user data. */
export function prepareSmoke(): void {
  app.setPath("userData", mkdtempSync(join(tmpdir(), "ctdp-smoke-")));
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

export async function runSmoke(main: BrowserWindow, mini: BrowserWindow, engine: Engine): Promise<void> {
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

    console.log(`SMOKE OK\n--- mini ---\n${miniText}\n--- main (seated) ---\n${mainText}`);
    app.exit(0);
  } catch (err) {
    console.error("SMOKE FAIL:", err);
    app.exit(1);
  }
}
