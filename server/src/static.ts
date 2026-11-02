import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Serves the built phone web app. Paths without an extension fall back to
 * index.html; nothing outside `root` is ever read. Returns false when there
 * is no such file.
 */
export async function serveStatic(root: string, pathname: string, res: ServerResponse, head: boolean): Promise<boolean> {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (rel.includes("\0")) return false;
  const base = resolve(root);
  let file = resolve(base, `.${rel}`);
  if (file !== base && !file.startsWith(base + sep)) return false;
  if (!(await isFile(file))) {
    if (extname(file)) return false;
    file = join(base, "index.html");
    if (!(await isFile(file))) return false;
  }
  const body = await readFile(file);
  // Hashed build assets never change; everything else is revalidated so updates show up.
  const immutable = file.startsWith(join(base, "assets") + sep);
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-length": body.length,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
  });
  res.end(head ? undefined : body);
  return true;
}
