import { it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "../..");

/**
 * Tailwind only generates classes it finds in the folders listed in tailwind.config.ts.
 * A folder of components that is missing there renders with silently missing styles
 * (this happened with src/widgets in Phase 0).
 */
it("Tailwind scans every source folder that contains components", () => {
  const config = fs.readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf-8");
  const globs = [...config.matchAll(/"\.\/(src\/[^*"]+)\/\*\*/g)].map((m) => m[1]);
  assert.ok(globs.length > 0, "no content globs found in tailwind.config.ts");

  const uncovered: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) {
        const rel = path.relative(ROOT, full).split(path.sep).join("/");
        if (!globs.some((g) => rel.startsWith(`${g}/`))) uncovered.push(rel);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(uncovered, [], "add these folders to `content` in tailwind.config.ts");
});
