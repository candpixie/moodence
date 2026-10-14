import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app under /moodence/. Local dev stays at /.
export default defineConfig({
  base: process.env.MOODENCE_BASE ?? "/",
  plugins: [react()],
});
