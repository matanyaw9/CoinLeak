import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const alias = {
  "@core": resolve("src/core"),
  "@shared": resolve("src/shared"),
};

export default defineConfig({
  main: {
    resolve: { alias },
    build: { externalizeDeps: true },
  },
  preload: {
    resolve: { alias },
    // Sandboxed preloads must be CommonJS.
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } },
    },
  },
  renderer: {
    resolve: { alias: { ...alias, "@": resolve("src/renderer/src") } },
    plugins: [react(), tailwindcss()],
  },
});
