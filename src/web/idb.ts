/** A tiny key-value store on IndexedDB. Writes are queued so they land in order. */
export class KeyValueStore {
  private queue: Promise<void> = Promise.resolve();

  private constructor(private readonly db: IDBDatabase) {}

  static open(name = "ctdp"): Promise<KeyValueStore> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(new KeyValueStore(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  get(key: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = this.db.transaction("kv").objectStore("kv").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Copies the value now (structured clone), writes it after earlier writes. */
  put(key: string, value: unknown): Promise<void> {
    const tx = this.db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.queue = this.queue.then(() => done).catch((err: unknown) => console.error(`saving ${key} failed:`, err));
    return this.queue;
  }
}
