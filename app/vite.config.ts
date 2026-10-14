import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The editor imports the library's source, not its build, so library edits
// hot-reload with no rebuild step. GitHub Pages serves the app under
// /moodence/; local dev stays at /.
export default defineConfig({
  base: process.env.MOODENCE_BASE ?? "/",
  plugins: [react()],
  resolve: {
    alias: { moodence: fileURLToPath(new URL("../packages/moodence/src/index.ts", import.meta.url)) },
  },
});
