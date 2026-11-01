import { join } from "node:path";
import { app } from "electron";

/** Icons ship as extraResources when packaged, and live in resources/ in dev. */
function resource(name: string): string {
  return app.isPackaged ? join(process.resourcesPath, name) : join(app.getAppPath(), "resources", name);
}

export const iconPath = () => resource("icon.png");
export const trayIconPath = () => resource("tray.png");

export const preloadPath = () => join(__dirname, "../preload/index.js");
export const pagePath = (name: string) => join(__dirname, "../renderer", name);
