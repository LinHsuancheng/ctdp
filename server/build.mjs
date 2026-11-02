// Bundles the server with the shared CTDP core; npm dependencies stay external.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
