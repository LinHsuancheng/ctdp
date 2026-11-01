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
    await textOf(main, "主链");
    engine.dispatch({ type: "reserve" });
    await textOf(main, "已预约");
    engine.dispatch({ type: "start", task: "冒烟测试", minutes: 1 });
    await textOf(main, "冒烟测试");
    check(mini.isVisible(), "mini window should be visible while focusing");
    const miniText = await textOf(mini, "专注中");

    engine.dispatch({ type: "violation", behavior: "看一眼手机", verdict: "allow" });
    check(engine.get().precedents.length === 1, "precedent not recorded");
    engine.dispatch({ type: "abandon" });
    check(engine.get().mainChain === 0 && engine.get().breaks.length === 1, "abandon did not break chain");
    check(engine.get().reserveChain === 1, "reservation should have been kept");
    await delay(300);
    check(!mini.isVisible(), "mini window should hide when idle");

    console.log(`SMOKE OK\n--- mini ---\n${miniText}\n--- main ---\n${await textOf(main, "主链")}`);
    app.exit(0);
  } catch (err) {
    console.error("SMOKE FAIL:", err);
    app.exit(1);
  }
}
