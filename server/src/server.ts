import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createPushSender } from "./push";
import { SyncStore } from "./store";

const config = loadConfig();
mkdirSync(config.dataDir, { recursive: true });
const store = new SyncStore(join(config.dataDir, "ctdp.db"));
const staticDir = existsSync(join(config.staticDir, "index.html")) ? config.staticDir : null;
if (!staticDir) console.warn(`no phone web app at ${config.staticDir}; run "npm run build:web" in the repository root`);
const app = createApp({ token: config.token, store, push: createPushSender(store, config.vapidSubject), staticDir });

app.server.listen(config.port, config.host, () => {
  console.log(`ctdp sync server on http://${config.host}:${config.port}, data in ${config.dataDir}`);
  if (staticDir) console.log(`phone web app from ${staticDir}`);
});

const shutdown = () => {
  void app.close().then(() => {
    store.close();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
