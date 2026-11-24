/**
 * Moves the original markdown files into their language's folder when a site is published with
 * a translation (server only). Nothing depends on it having happened: files that aren't moved
 * (read-only folder, name taken, too deep) are still found (`contentCandidates`).
 */
import fs from "fs";
import path from "path";
import { CONTENT_DIR, listContent, resolveContentFile } from "@/lib/content";
import type { HomepageConfig } from "@/lib/schema/config";
import { COMMON_LANGUAGES, contentLanguages, contentPlace } from "./languages";

type Languages = HomepageConfig["languages"];

/** Removes `dir` and its parents inside the content folder while they are empty. */
export function removeEmptyFolders(dir: string) {
  while (dir.startsWith(CONTENT_DIR + path.sep)) {
    try {
      fs.rmdirSync(dir); // refuses a folder that isn't empty
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

/** Renames one content file; never over another. Whether it moved. */
function moveFile(from: string, to: string): boolean {
  const src = resolveContentFile(from);
  const dest = resolveContentFile(to);
  if (!src || !dest || fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
  removeEmptyFolders(path.dirname(src));
  return true;
}

export function organizeContent(next: Languages, previous?: Languages): { from: string; to: string }[] {
  const languages = contentLanguages(next);
  const moved: { from: string; to: string }[] = [];
  const move = (from: string, to: string) => {
    if (moveFile(from, to)) moved.push({ from, to });
  };

  // The original turned out to be in another language: its folder is renamed.
  const old = previous?.original;
  if (old && old !== next.original && !languages.codes.includes(old)) {
    for (const { name } of listContent().files) if (name.startsWith(`${old}/`)) move(name, `${next.original}/${name.slice(old.length + 1)}`);
  }

  // A site in one language isn't split.
  if (!next.translations.length) return moved;
  const names = listContent().files.map((f) => f.name);
  const files = new Set(names);
  for (const name of names) {
    if (contentPlace(name, languages, files).code !== null) continue;
    // A folder named like a language the site doesn't have is left alone: it may be a removed translation.
    if (name.includes("/") && COMMON_LANGUAGES.includes(name.slice(0, name.indexOf("/")))) continue;
    move(name, `${next.original}/${name}`);
  }
  return moved;
}
