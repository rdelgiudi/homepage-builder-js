import fs from "fs";
import path from "path";
import { COMMON_LANGUAGES, LANGUAGE_CODE, contentCandidates, type ContentLanguages } from "@/lib/i18n/languages";

export const CONTENT_DIR = path.join(process.cwd(), "src", "content");

/** Folders a content path may have above its file ("a/b/c/d/file.md" at most), plus a language's folder at the start. */
export const MAX_FOLDER_DEPTH = 4;

/** One folder name: starts with a letter or digit (so never "." / ".." / hidden), no slashes. */
const FOLDER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.md$/;

/**
 * Checks a content path from a request ("notes/2026/todo.md"): `/`-separated parts that are each
 * a plain name. Returns the parts, or null. Nothing else (no `..`, no leading `/`, no
 * backslashes, no empty parts) ever reaches the file system.
 */
function parts(name: unknown, file: boolean): string[] | null {
  if (typeof name !== "string" || !name || name.length > 400) return null;
  const p = name.split("/");
  const folders = file ? p.slice(0, -1) : p;
  if (folders.length > MAX_FOLDER_DEPTH + (LANGUAGE_CODE.test(folders[0] ?? "") ? 1 : 0)) return null;
  // A folder named like a file ("x.md") would make paths ambiguous in the editor's tree.
  if (!folders.every((s) => FOLDER.test(s) && !s.endsWith(".md"))) return null;
  if (file && !FILE_NAME.test(p[p.length - 1])) return null;
  return p;
}

function inside(p: string[]): string | null {
  const resolved = path.join(CONTENT_DIR, ...p);
  return resolved.startsWith(CONTENT_DIR + path.sep) ? resolved : null;
}

/**
 * Maps a markdown file path from a request ("about.md", "blog/2026/hello.md") to its place inside
 * CONTENT_DIR, or `null` if it isn't a plain `*.md` path (see `parts`).
 */
export function resolveContentFile(name: string | null | undefined): string | null {
  const p = parts(name, true);
  return p ? inside(p) : null;
}

/** The same for a folder ("blog/2026"). The content folder itself is never a valid answer. */
export function resolveContentFolder(name: string | null | undefined): string | null {
  const p = parts(name, false);
  return p ? inside(p) : null;
}

/**
 * The file to show for a content file's name: its translation into `lang` if there is one, else
 * the original, wherever that is (`contentCandidates`). Null when there is none, or the name
 * isn't a plain `*.md` path.
 */
export function findContentFile(name: string, languages: ContentLanguages, lang?: string | null): { name: string; path: string } | null {
  if (!resolveContentFile(name)) return null;
  for (const candidate of contentCandidates(name, languages, lang)) {
    const file = resolveContentFile(candidate);
    if (file && fs.existsSync(file)) return { name: candidate, path: file };
  }
  // The original language was changed but its folder wasn't renamed (edited by hand, or the
  // folder is read-only): better any language than nothing.
  for (const code of COMMON_LANGUAGES) {
    const file = resolveContentFile(`${code}/${name}`);
    if (file && fs.existsSync(file)) return { name: `${code}/${name}`, path: file };
  }
  return null;
}

export interface ContentFile {
  /** Path relative to the content folder, with `/` ("blog/hello.md"). */
  name: string;
  bytes: number;
  modifiedAt: number;
}

/**
 * Every markdown file and folder under CONTENT_DIR (or under `folder`), as relative `/` paths,
 * sorted. Anything that wouldn't pass `resolveContentFile` / `resolveContentFolder` (hidden
 * files, odd names, too deep) is left out, so the list only ever holds names the routes accept.
 */
export function listContent(folder = ""): { files: ContentFile[]; folders: string[] } {
  const files: ContentFile[] = [];
  const folders: string[] = [];
  const walk = (rel: string) => {
    let entries: string[];
    try {
      entries = fs.readdirSync(rel ? path.join(CONTENT_DIR, ...rel.split("/")) : CONTENT_DIR);
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = rel ? `${rel}/${entry}` : entry;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(path.join(CONTENT_DIR, ...name.split("/"))); // follows symlinks, like before
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        // (also what limits the depth)
        if (resolveContentFolder(name)) {
          folders.push(name);
          walk(name);
        }
      } else if (stat.isFile() && resolveContentFile(name)) {
        files.push({ name, bytes: stat.size, modifiedAt: stat.mtimeMs });
      }
    }
  };
  walk(folder);
  files.sort((a, b) => a.name.localeCompare(b.name));
  folders.sort();
  return { files, folders };
}
