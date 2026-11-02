import { BrowserWindow, screen, type WebPreferences } from "electron";
import { iconPath, pagePath, preloadPath } from "./paths";

const webPreferences = (): WebPreferences => ({
  preload: preloadPath(),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
});

/** Pages are local files only; refuse popups and navigation away from them. */
function lockDown(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    show: false,
    title: "CTDP",
    icon: iconPath(),
    autoHideMenuBar: true,
    backgroundColor: "#faf9f5",
    webPreferences: webPreferences(),
  });
  lockDown(win);
  win.once("ready-to-show", () => win.show());
  void win.loadFile(pagePath("index.html"));
  return win;
}

const MINI = { width: 300, height: 128, margin: 16 };

/** Small always-on-top countdown shown while reserved or focusing. */
export function createMiniWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: MINI.width,
    height: MINI.height,
    x: workArea.x + workArea.width - MINI.width - MINI.margin,
    y: workArea.y + workArea.height - MINI.height - MINI.margin,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: false,
    show: false,
    webPreferences: webPreferences(),
  });
  win.setAlwaysOnTop(true, "floating");
  lockDown(win);
  void win.loadFile(pagePath("mini.html"));
  return win;
}
