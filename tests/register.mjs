// Lets `node --test` load the app's TypeScript the way Next.js does: resolves the `@/`
// path alias and extensionless imports (`./meta` → `./meta.ts`). Node itself strips the
// types; it cannot run JSX, so tests may only reach `.ts` / `.js` files, never `.tsx`.
import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
/** Relative imports are resolved the TypeScript way inside these folders. */
const OWN = [SRC, path.join(ROOT, "tests")].map((dir) => pathToFileURL(dir).href + "/");
const EXTENSIONS = ["", ".ts", ".js", "/index.ts"];

const existing = (base) => EXTENSIONS.map((ext) => base + ext).find((file) => fs.existsSync(file) && fs.statSync(file).isFile());

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
    else if (specifier.startsWith(".") && OWN.some((dir) => context.parentURL?.startsWith(dir))) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    const file = base && existing(base);
    return nextResolve(file ? pathToFileURL(file).href : specifier, context);
  },
});
