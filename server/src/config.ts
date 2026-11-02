import { join, resolve } from "node:path";

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  /** The built phone web app (`npm run build:web` at the repository root). */
  staticDir: string;
  /** Shared secret every device sends as a bearer token. */
  token: string;
  /** Contact for push services: mailto: or https: URL. */
  vapidSubject: string;
}

/** Reads the environment; throws with a readable message when something is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.CTDP_TOKEN ?? "";
  if (token.length < 16) throw new Error("CTDP_TOKEN must be set to a random string of at least 16 characters");
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`invalid PORT: ${env.PORT}`);
  return {
    host: env.HOST ?? "127.0.0.1",
    port,
    dataDir: resolve(env.CTDP_DATA_DIR ?? "data"),
    // The bundle runs from server/dist, so the default is <repo>/dist/web.
    staticDir: resolve(env.STATIC_DIR ?? join(__dirname, "../../dist/web")),
    token,
    vapidSubject: env.VAPID_SUBJECT ?? "mailto:ctdp@localhost",
  };
}
