// Bundles the Electron main and preload scripts. The preload runs sandboxed,
// so it must be a single file with no local requires.
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
};

await Promise.all([
  build({ ...common, entryPoints: ["src/main/index.ts"], outfile: "dist/main/index.js" }),
  build({ ...common, entryPoints: ["src/preload/index.ts"], outfile: "dist/preload/index.js" }),
]);
