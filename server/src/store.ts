import { DatabaseSync } from "node:sqlite";
import { parseState, type CtdpState, type LogEntry } from "../../src/shared/ctdp";
import type { PushSubscription } from "web-push";

interface EntryRow {
  server_seq: number;
  id: string;
  device: string;
  seq: number;
  at: number;
  action: string;
}

const toEntry = (r: EntryRow): LogEntry => ({ id: r.id, device: r.device, seq: r.seq, at: r.at, action: JSON.parse(r.action) });

/**
 * The shared log in SQLite. Entries get a server sequence number on arrival,
 * which is the cursor devices sync from; the replay order is still by time.
 */
export class SyncStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entries (
        server_seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        device TEXT NOT NULL,
        seq INTEGER NOT NULL,
        at INTEGER NOT NULL,
        action TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint TEXT PRIMARY KEY,
        device TEXT NOT NULL,
        json TEXT NOT NULL
      );
    `);
  }

  private meta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setMeta(key: string, value: string): void {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  base(): CtdpState | null {
    const raw = this.meta("base");
    return raw ? parseState(JSON.parse(raw)) : null;
  }

  /** Stores the first device's data; false if the server already has some. */
  seed(base: CtdpState, entries: LogEntry[]): boolean {
    if (this.base()) return false;
    this.db.exec("BEGIN");
    try {
      this.setMeta("base", JSON.stringify(base));
      this.insertRows(entries);
      this.db.exec("COMMIT");
      return true;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /** Adds entries not seen before; known ids are ignored. */
  insert(entries: LogEntry[]): void {
    this.db.exec("BEGIN");
    try {
      this.insertRows(entries);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  private insertRows(entries: LogEntry[]): void {
    const stmt = this.db.prepare("INSERT OR IGNORE INTO entries (id, device, seq, at, action) VALUES (?, ?, ?, ?, ?)");
    for (const e of entries) stmt.run(e.id, e.device, e.seq, e.at, JSON.stringify(e.action));
  }

  since(cursor: number): LogEntry[] {
    const rows = this.db.prepare("SELECT * FROM entries WHERE server_seq > ? ORDER BY server_seq").all(cursor) as unknown as EntryRow[];
    return rows.map(toEntry);
  }

  cursor(): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(server_seq), 0) AS c FROM entries").get() as { c: number };
    return row.c;
  }

  ackSeq(device: string): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM entries WHERE device = ?").get(device) as { s: number };
    return row.s;
  }

  vapidKeys(): { publicKey: string; privateKey: string } | null {
    const raw = this.meta("vapid");
    return raw ? JSON.parse(raw) : null;
  }

  setVapidKeys(keys: { publicKey: string; privateKey: string }): void {
    this.setMeta("vapid", JSON.stringify(keys));
  }

  subscriptions(): PushSubscription[] {
    const rows = this.db.prepare("SELECT json FROM subscriptions").all() as { json: string }[];
    return rows.map((r) => JSON.parse(r.json));
  }

  subscribe(device: string, sub: PushSubscription): void {
    this.db
      .prepare("INSERT INTO subscriptions (endpoint, device, json) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET device = excluded.device, json = excluded.json")
      .run(sub.endpoint, device, JSON.stringify(sub));
  }

  unsubscribe(endpoint: string): void {
    this.db.prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(endpoint);
  }

  close(): void {
    this.db.close();
  }
}
