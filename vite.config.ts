import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = resolve(__dirname, "src/renderer");

// Renderer only; main and preload are bundled by scripts/build-main.mjs.
export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        mini: resolve(root, "mini.html"),
      },
    },
  },
});
