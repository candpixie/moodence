// Run every example and fail if any exits non-zero. CI calls this.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
for (const file of readdirSync(dir).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort()) {
  console.log(`\n=== ${file}`);
  execFileSync(process.execPath, [file], { cwd: dir, stdio: "inherit" });
}
