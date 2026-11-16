import fs from "fs";
import path from "path";
import { CONFIG_PATH } from "@/lib/config";
import type { HomepageConfig } from "@/lib/schema/config";
import { parseConfig } from "@/lib/schema/parse";
import { addRevision, getDraft } from "./store";

export function readPublishedRaw(): string | null {
  try {
    return fs.readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return null;
  }
}

export function isWritable(target: string): boolean {
  try {
    fs.accessSync(fs.existsSync(target) ? target : path.dirname(target), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes `config` the live homepage.json. The previous file content is stored as a
 * revision first, and the write is atomic (temp file + rename) so a crash can't leave
 * a half-written config behind.
 */
export function publishConfig(config: HomepageConfig, note: string) {
  const next = JSON.stringify(config, null, 2) + "\n";
  const previous = readPublishedRaw();
  if (previous === next) return;
  if (previous !== null) addRevision(previous, note);

  const tmp = `${CONFIG_PATH}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(tmp, next);
    fs.renameSync(tmp, CONFIG_PATH);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new Error("homepage.json is not writable. If you run in Docker, mount src/config without :ro.");
    }
    if (code === "EBUSY" || code === "EXDEV") {
      // The file itself is a mount point and can't be replaced by rename — write in place.
      fs.writeFileSync(CONFIG_PATH, next);
      return;
    }
    throw err;
  }
}

/** The saved draft as a usable config, or `null` if there is none. */
export function getDraftConfig(): HomepageConfig | null {
  const stored = getDraft();
  return stored ? parseConfig(stored.value).config : null;
}
