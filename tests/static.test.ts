import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "../server/src/app";
import { SyncStore } from "../server/src/store";

let dir: string;
let app: App;
let store: SyncStore;
let url: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "ctdp-static-"));
  const web = join(dir, "web");
  mkdirSync(join(web, "assets"), { recursive: true });
  writeFileSync(join(web, "index.html"), "<!doctype html><title>CTDP</title>");
  writeFileSync(join(web, "sw.js"), "// worker");
  writeFileSync(join(web, "assets", "index-abc123.js"), "console.log(1)");
  writeFileSync(join(dir, "secret.txt"), "outside the web root");
  store = new SyncStore(":memory:");
  app = createApp({ token: "test-token-0123456789", store, push: { publicKey: "pk", send: async () => {} }, staticDir: web });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await app.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("phone web app hosting", () => {
  it("serves the app shell without caching it", async () => {
    const res = await fetch(`${url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("<title>CTDP</title>");
    expect((await fetch(`${url}/sw.js`)).headers.get("cache-control")).toBe("no-cache");
  });

  it("caches hashed assets for good", async () => {
    const res = await fetch(`${url}/assets/index-abc123.js`);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("falls back to the app for page paths, not for missing files", async () => {
    expect(await (await fetch(`${url}/settings`)).text()).toContain("CTDP");
    expect((await fetch(`${url}/missing.js`)).status).toBe(404);
  });

  it("never reads outside the web root", async () => {
    for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/%00"]) {
      const res = await fetch(`${url}${path}`);
      expect(await res.text()).not.toContain("outside the web root");
    }
  });

  it("keeps the API behind the token", async () => {
    expect((await fetch(`${url}/api/data`)).status).toBe(401);
    expect((await fetch(`${url}/`, { method: "POST" })).status).toBe(404);
  });
});
