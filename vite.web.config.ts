import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The phone web app, served by the sync server at its site root.
export default defineConfig({
  root: resolve(__dirname, "src/web"),
  base: "/",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
  },
});
