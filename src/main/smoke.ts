import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import type { Engine, SyncClient } from "../shared/runtime";
import { DEFAULT_SUMMON, defaultState, entryId, type LogEntry } from "../shared/ctdp";
import { deviceFile, readDataFile, saveData } from "./store";

/**
 * Headless end-to-end check used by scripts/smoke.sh: drives the engine and
 * reads back what both windows render, then exits with a status code.
 */
export const isSmoke = () => process.argv.includes("--smoke");


/**
 * Must run before app ready so the check never touches real user data. Starts
 * from a version-2 (single-device) file to exercise the upgrade.
 */
export function prepareSmoke(): void {
  const dir = mkdtempSync(join(tmpdir(), "ctdp-smoke-"));
  app.setPath("userData", dir);
  const v2 = { ...defaultState(), version: 2, settings: { reserveShortcut: "CommandOrControl+Alt+F9", showMiniWindow: true, notifications: false } };
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

const js = <T>(win: BrowserWindow, code: string): Promise<T> => win.webContents.executeJavaScript(code);
const clickButton = (win: BrowserWindow, label: string) =>
  js<boolean>(win, `(() => { const b = [...document.querySelectorAll("button")].find((b) => b.textContent.startsWith(${JSON.stringify(label)}) && !b.disabled); b?.click(); return !!b; })()`);
/** Presses and holds a hold-to-confirm button long enough to fire it. */
async function hold(win: BrowserWindow, label: string): Promise<void> {
  const found = await js<boolean>(
    win,
    `(() => { const b = document.querySelector('[data-hold=${JSON.stringify(label)}]'); b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); return !!b; })()`,
  );
  check(found, `no hold button "${label}"`);
  await delay(2300);
}
/** A short click on a hold button must do nothing. */
async function tap(win: BrowserWindow, label: string): Promise<void> {
  await js(
    win,
    `(() => { const b = document.querySelector('[data-hold=${JSON.stringify(label)}]'); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); b.click(); })()`,
  );
  await delay(300);
}
const typeInto = (win: BrowserWindow, selector: string, value: string) =>
  js(
    win,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
    })()`,
  );

async function until(cond: () => Promise<boolean>, what: string, timeoutMs = 8000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await cond()) return;
    await delay(200);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Saves a screenshot when CTDP_SMOKE_SHOTS names a folder. */
async function shot(win: BrowserWindow, name: string): Promise<void> {
  const dir = process.env.CTDP_SMOKE_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), (await win.webContents.capturePage()).toPNG());
}

/**
 * The phone web app, served by the same sync server, in an iPhone-sized
 * window with its own storage: connect with the token, reserve on the phone,
 * see it on the desktop and back, and survive a reload.
 */
async function phoneSmoke(url: string, token: string, engine: Engine, sync: SyncClient): Promise<void> {
  const phone = new BrowserWindow({ width: 390, height: 844, useContentSize: true, webPreferences: { partition: "phone-smoke", sandbox: true, contextIsolation: true } });
  await phone.loadURL(`${url}/`);
  await textOf(phone, "Connect CTDP");
  await shot(phone, "phone-connect");
  await js(
    phone,
    `(() => {
      const input = document.querySelector("input[type=password]");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(token)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`,
  );
  check(await clickButton(phone, "Connect"), "the phone should show a Connect button");
  await textOf(phone, "Action");
  const phoneCategories = () => js<string[]>(phone, "window.ctdp.getState().then((s) => s.categories.map((c) => c.name))");
  check((await phoneCategories()).includes("Synced category"), "the phone should take the server's data");
  // Nothing may stick out past the screen edge, except inside the scrollable tab bar.
  const overflow = () =>
    js<string[]>(
      phone,
      `[...document.querySelectorAll("body *")]
        .filter((el) => !el.closest(".tabs") && el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => el.tagName + "." + el.className + ": " + (el.textContent ?? "").slice(0, 40))
        .concat(document.documentElement.scrollWidth > window.innerWidth ? ["page scrolls sideways"] : [])`,
    );
  const noSideScroll = async () => {
    const out = await overflow();
    if (out.length) console.error("overflowing on the phone:", out);
    return out.length === 0;
  };
  check(await noSideScroll(), "the phone layout should not scroll sideways");
  check(!(await textOf(phone, "Reserve")).includes("Shortcut"), "the phone should not show desktop shortcuts");
  await shot(phone, "phone-focus");

  // Reserve on the phone; the desktop gets it.
  check(await clickButton(phone, "Reserve"), "the phone should offer Reserve");
  await textOf(phone, "Snap fingers once");
  check(await clickButton(phone, "Done"), "the phone's dimmed prompt should offer Done");
  await textOf(phone, "Reserved");
  await shot(phone, "phone-reserved");
  await until(async () => {
    await sync.syncNow();
    return engine.get().reservation !== null;
  }, "the phone's reservation to reach the desktop");

  // The desktop acts; the phone gets it.
  engine.dispatch({ type: "saveCategory", categoryId: null, name: "From desktop" });
  await sync.syncNow();
  await until(async () => {
    await js(phone, "window.ctdp.syncNow()");
    return (await phoneCategories()).includes("From desktop");
  }, "the desktop's action to reach the phone");

  check(await clickButton(phone, "More"), "the phone should offer More");
  const openTab = (name: string) => js(phone, `[...document.querySelectorAll(".tabs button")].find((b) => b.textContent === ${JSON.stringify(name)})?.click()`);
  for (const tab of ["Chains", "Chunks", "Precedents", "History"]) {
    await openTab(tab);
    await delay(200);
    check(await noSideScroll(), `the phone ${tab} tab should not scroll sideways`);
    await shot(phone, `phone-${tab.toLowerCase()}`);
  }
  await openTab("Settings");
  const settingsText = await textOf(phone, "Synced at");
  check(settingsText.includes("This switch only affects this phone"), "the phone should show its notification switch");
  check(!settingsText.includes("Shortcut to bring up") && !settingsText.includes("Show in folder"), "desktop-only settings should be hidden on the phone");
  check(await noSideScroll(), "the phone settings should not scroll sideways");
  await shot(phone, "phone-settings");
  check(await js<boolean>(phone, "navigator.serviceWorker.getRegistration().then((r) => !!r)"), "the service worker should be registered");

  // Data stays on the phone across reloads.
  phone.webContents.reload();
  await textOf(phone, "Reserved");
  check((await phoneCategories()).includes("From desktop"), "the phone should keep its data after a reload");
  phone.destroy();
}

export async function runSmoke(main: BrowserWindow, mini: BrowserWindow, engine: Engine, sync: SyncClient): Promise<void> {
  try {
    const chainId = engine.get().primaryChainId!;
    const chain = () => engine.get().chains.find((c) => c.id === chainId)!;
    const homeText = await textOf(main, "Action");
    check(homeText.includes("Reserve") && homeText.toLowerCase().includes("desk"), "home should show the chain and two buttons");
    await shot(main, "home");

    // A sitting that started an hour ago, so it can be finished and signed now.
    const data = engine.getData();
    const seated: LogEntry = {
      id: entryId("seed", 1),
      device: "seed",
      seq: 1,
      at: Date.now() - 61 * 60_000,
      action: { type: "seat", chainId, chunkId: "chunk-focus", task: "Signed sitting", minutes: 60, categoryId: null },
    };
    engine.replace({ ...data, log: [...data.log, seated] });
    await textOf(main, "Minimum reached");
    await shot(main, "seated");
    check(await clickButton(main, "Finish"), "a sitting past its minimum should offer Finish");
    await textOf(main, "done — sign it");
    await shot(main, "sign");
    // Reporting a violation needs a hold and then a confirmation; cancel it.
    await tap(main, "It was a violation — break chain");
    check(!(await js<string>(main, "document.body.innerText")).includes("Break the chain?"), "a tap must not start breaking the chain");
    await hold(main, "It was a violation — break chain");
    await textOf(main, "Break the chain?");
    await shot(main, "confirm-break");
    check(await clickButton(main, "Cancel"), "the confirmation should offer Cancel");
    await textOf(main, "done — sign it");
    check(engine.get().seat !== null, "cancelling must keep the sitting");
    // Sign with a new precedent.
    check(await clickButton(main, "Something to allow forever"), "signing should offer to allow something");
    await typeInto(main, ".dialog textarea", "Got water");
    check(await clickButton(main, "Allow forever and sign"), "allow and sign should be enabled");
    await until(async () => engine.get().seat === null, "the sitting to be signed");
    check(chain().main.precedents.some((p) => p.behavior === "Got water"), "the allowed behavior should become a precedent");
    check(chain().main.counters[0].current === 1, "signing keeps the node");
    await textOf(main, "#1 signed");

    // Reserve: the dimmed prompt shows the signal, then the countdown starts.
    check(await clickButton(main, "Reserve"), "home should offer Reserve");
    await textOf(main, "Snap fingers once");
    await shot(main, "dim-reserve");
    check(await clickButton(main, "Done"), "the dimmed prompt should offer Done");
    await until(async () => engine.get().reservation !== null, "the reservation");
    await textOf(main, "Reserved — sit down in time");
    await delay(300);
    check(mini.isVisible(), "the corner card should show while reserved");
    await textOf(mini, "Reserved");

    // Action from the corner card opens the dimmed sacred-seat prompt in the main window.
    await js(mini, `window.ctdp.openMain("action")`);
    await textOf(main, "Put on headphones and sit at the desk");
    await shot(main, "dim-action");
    check(await clickButton(main, "Done"), "the sacred-seat prompt should offer Done");
    await until(async () => engine.get().seat !== null, "sitting down");
    check(chain().auxiliary.counter.current === 1, "sitting down in time keeps the reservation");
    check(engine.settings().lastStart.chunkId === "chunk-focus", "Action should remember its settings");
    const miniText = await textOf(mini, "Hold to leave");
    const mainText = await textOf(main, "Hold to break chain");
    await shot(mini, "mini-seated");

    // Leaving from the corner card asks for confirmation in the main window.
    await hold(mini, "Hold to leave");
    await textOf(main, "Break the chain?");
    check(await clickButton(main, "Break chain"), "the confirmation should offer Break chain");
    await until(async () => engine.get().successionPending, "losing the primary chain");
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
    check(engine.settings().notifications === false && engine.settings().summonShortcut === DEFAULT_SUMMON, "version-2 settings should move to this device");
    check(existsSync(join(app.getPath("userData"), "ctdp-state.json.v2-backup")), "the version-2 file should be backed up");
    check(await clickButton(main, "More"), "home should offer More");
    await js(main, `[...document.querySelectorAll(".tabs button")].find((b) => b.textContent === "Settings")?.click()`);
    await textOf(main, "ctdp-state.json");
    const settingsText = await textOf(main, "Shortcut to bring up CTDP");
    check(/Works|another app|valid/.test(settingsText), "the shortcut status should show");
    // Record a new shortcut by pressing it.
    check(await clickButton(main, "Change"), "the shortcut should offer Change");
    await js(main, `document.querySelector(".recorder").dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK", key: "k", ctrlKey: true, altKey: true, bubbles: true }))`);
    await until(async () => {
      const text = await js<string>(main, "document.body.innerText");
      return engine.settings().summonShortcut === "Control+Alt+K" || text.includes("Try another combination");
    }, "the recorded shortcut to be checked");
    await shot(main, "settings");

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
    await phoneSmoke(url!, token!, engine, sync);

    console.log(`SMOKE OK\n--- mini ---\n${miniText}\n--- main (seated) ---\n${mainText}\n--- shortcut ---\n${engine.settings().summonShortcut}`);
    app.exit(0);
  } catch (err) {
    console.error("SMOKE FAIL:", err);
    app.exit(1);
  }
}
