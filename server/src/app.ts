import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isEntry, parseState, replay, type DataResponse, type LogEntry, type SyncResponse } from "../../src/shared/ctdp";
import type { PushSender } from "./push";
import { ReminderScheduler } from "./reminders";
import { serveStatic } from "./static";
import type { SyncStore } from "./store";

const MAX_BODY = 10 * 1024 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const digest = (s: string) => createHash("sha256").update(s).digest();

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, "body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new HttpError(400, "invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function entriesOf(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw) || !raw.every(isEntry)) throw new HttpError(400, "invalid entries");
  return raw;
}

export interface App {
  server: Server;
  /** Pending reminder keys, for tests. */
  reminders: ReminderScheduler;
  close(): Promise<void>;
}

/**
 * The sync API, plus the phone web app from `staticDir` at every other path.
 * All API routes but /api/health need `Authorization: Bearer <token>`.
 */
export function createApp(opts: { token: string; store: SyncStore; push: PushSender; staticDir?: string | null }): App {
  const { store, push } = opts;
  const expected = digest(opts.token);
  const reminders = new ReminderScheduler((r) => void push.send(r));

  const refresh = () => {
    const base = store.base();
    if (base) reminders.schedule(replay(base, store.since(0)).state);
  };
  refresh();

  const authorized = (req: IncomingMessage) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    return timingSafeEqual(digest(token), expected);
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const method = req.method ?? "GET";
    if (path === "/api/health") return send(res, 200, { ok: true });
    if (!path.startsWith("/api/")) {
      const served = opts.staticDir && (method === "GET" || method === "HEAD") && (await serveStatic(opts.staticDir, path, res, method === "HEAD"));
      if (!served) throw new HttpError(404, "not found");
      return;
    }
    if (!authorized(req)) throw new HttpError(401, "wrong or missing token");

    const at = `${method} ${path}`;
    if (at === "GET /api/data") {
      const body: DataResponse = { base: store.base(), entries: store.since(0), cursor: store.cursor() };
      return send(res, 200, body);
    }
    if (at === "POST /api/seed") {
      const raw = await readJson(req);
      const base = isObject(raw) ? parseState(raw.base) : null;
      if (!isObject(raw) || !base) throw new HttpError(400, "invalid base");
      if (!store.seed(base, entriesOf(raw.entries))) throw new HttpError(409, "server already has data");
      refresh();
      return send(res, 200, { cursor: store.cursor() });
    }
    if (at === "POST /api/sync") {
      const raw = await readJson(req);
      if (!isObject(raw) || typeof raw.device !== "string" || typeof raw.since !== "number") throw new HttpError(400, "invalid sync request");
      if (!store.base()) throw new HttpError(409, "server is empty");
      const entries = entriesOf(raw.entries);
      if (entries.length) {
        store.insert(entries);
        refresh();
      }
      const body: SyncResponse = { entries: store.since(raw.since), cursor: store.cursor(), ackSeq: store.ackSeq(raw.device) };
      return send(res, 200, body);
    }
    if (at === "GET /api/push/key") return send(res, 200, { publicKey: push.publicKey });
    if (at === "POST /api/push/subscribe") {
      const raw = await readJson(req);
      const sub = isObject(raw) && isObject(raw.subscription) ? raw.subscription : null;
      if (!isObject(raw) || typeof raw.device !== "string" || !sub || typeof sub.endpoint !== "string" || !isObject(sub.keys)) {
        throw new HttpError(400, "invalid subscription");
      }
      store.subscribe(raw.device, sub as never);
      return send(res, 200, { ok: true });
    }
    if (at === "POST /api/push/unsubscribe") {
      const raw = await readJson(req);
      if (!isObject(raw) || typeof raw.endpoint !== "string") throw new HttpError(400, "invalid endpoint");
      store.unsubscribe(raw.endpoint);
      return send(res, 200, { ok: true });
    }
    if (at === "POST /api/push/test") {
      await push.send({ title: "CTDP", body: "Notifications work on this device." });
      return send(res, 200, { ok: true });
    }
    throw new HttpError(404, "not found");
  }

  const server = createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: "internal error" });
    });
  });

  return {
    server,
    reminders,
    close: () =>
      new Promise((resolve) => {
        reminders.stop();
        server.close(() => resolve());
      }),
  };
}
