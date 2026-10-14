import { defineConfig } from "vite";

// Library build: one ES module with cantojam's data and @tonejs/midi inlined.
// @tonejs/midi is CommonJS, and a named import of it fails under plain Node
// ESM, so it is bundled rather than left external.
export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "moodence.js" },
    target: "es2020",
    minify: false,
    sourcemap: true,
  },
});
