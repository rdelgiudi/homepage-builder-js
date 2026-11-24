/** The Content screen's folder tree (pure, unit-tested). Paths are relative to src/content, with `/`. */
import { contentCandidates, contentPlace, isOriginal, type ContentLanguages } from "@/lib/i18n/languages";

export interface TreeFile {
  /** Full path, e.g. "blog/hello.md". */
  name: string;
  bytes: number;
  modifiedAt: number;
}

export interface TreeFolder {
  /** Last part of the path ("" for the content folder itself). */
  label: string;
  /** Full path ("" for the content folder itself). */
  path: string;
  folders: TreeFolder[];
  files: TreeFile[];
  /** Files in this folder and everything below it. */
  count: number;
}

export const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
export const parentOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
/** `child` inside `folder` ("" = the content folder). */
export const joinPath = (folder: string, child: string) => (folder ? `${folder}/${child}` : child);

/** Folders first, then files, each alphabetical. Folders that only exist as a file's parent are added too. */
export function contentTree(files: TreeFile[], folders: string[]): TreeFolder {
  const root: TreeFolder = { label: "", path: "", folders: [], files: [], count: 0 };
  const byPath = new Map<string, TreeFolder>([["", root]]);
  const folderAt = (path: string): TreeFolder => {
    const hit = byPath.get(path);
    if (hit) return hit;
    const node: TreeFolder = { label: baseName(path), path, folders: [], files: [], count: 0 };
    byPath.set(path, node);
    folderAt(parentOf(path)).folders.push(node);
    return node;
  };
  for (const f of [...folders].sort()) folderAt(f);
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    folderAt(parentOf(file.name)).files.push(file);
    for (let p = parentOf(file.name); ; p = parentOf(p)) {
      byPath.get(p)!.count++;
      if (!p) break;
    }
  }
  const sort = (node: TreeFolder) => {
    node.folders.sort((a, b) => a.label.localeCompare(b.label));
    node.folders.forEach(sort);
  };
  sort(root);
  return root;
}

/** Where an item lands when it is dropped on `folder`; null when that changes nothing or is impossible. */
export function dropTarget(item: string, folder: string): string | null {
  const to = joinPath(folder, baseName(item));
  if (to === item) return null;
  // A folder can't go into itself or anything below it.
  if (!item.endsWith(".md") && (folder === item || folder.startsWith(`${item}/`))) return null;
  return to;
}

// --- one tree for every language: the language folders are how files are stored, not folders to show ---

export interface LanguageFile extends TreeFile {
  /** `name` is without the language folder; this is the file on disk that is shown for it. */
  path: string;
  /** Whether this language has the file, or another language's is shown ("missing"). */
  state: "own" | "missing";
  /** The language of the file that is shown. */
  shownIn: string;
  /** Where saving in this language writes. */
  saveTo: string;
}

export interface LanguageView {
  files: LanguageFile[];
  folders: string[];
  /** Languages to choose from: the original, the site's translations, and any other found on disk. */
  codes: string[];
  /** Where a new original goes ("en/", or "" in a site that isn't split by language). */
  base: string;
  /** Originals that are never shown because another file with the same name comes first. */
  shadowed: string[];
}

/** The files and folders as they are in one language. Every language has the same tree. */
export function languageView(files: TreeFile[], folders: string[], languages: ContentLanguages, lang: string): LanguageView {
  const { original, previous } = languages;
  const byPath = new Map(files.map((f) => [f.name, f]));
  const names = new Set(byPath.keys());
  const places = files.map((f) => ({ file: f, ...contentPlace(f.name, languages, names) }));
  const codes = [...new Set([original, ...languages.codes, ...places.flatMap((p) => (p.code && !isOriginal(p, languages) ? [p.code] : []))])];
  const split = languages.codes.length > 0 || places.some((p) => p.code === original || p.code === previous);
  // Until a changed original is published, its files are in the old one's folder.
  const base = split ? `${previous ?? original}/` : "";

  const shadowed: string[] = [];
  const out = [...new Set(places.map((p) => p.name))].flatMap((name): LanguageFile[] => {
    const found = contentCandidates(name, languages, lang).flatMap((c) => byPath.get(c) ?? []);
    const [file] = found;
    const place = file && places.find((p) => p.file === file);
    if (!place) return [];
    const originals = places.filter((p) => p.name === name && isOriginal(p, languages)).map((p) => p.file.name);
    const shown = contentCandidates(name, languages).find((c) => originals.includes(c));
    shadowed.push(...originals.filter((f) => f !== shown));
    const own = lang === original ? isOriginal(place, languages) : place.code === lang;
    return [
      {
        ...file,
        name,
        path: file.name,
        state: own ? "own" : "missing",
        shownIn: isOriginal(place, languages) ? original : place.code!,
        saveTo: own ? file.name : lang === original ? base + name : `${lang}/${name}`,
      },
    ];
  });

  const plain = new Set<string>();
  for (const f of folders) {
    const top = f.split("/")[0];
    if (top !== previous && !codes.includes(top)) plain.add(f);
    else if (f !== top) plain.add(f.slice(top.length + 1));
  }
  return { files: out.sort((a, b) => a.name.localeCompare(b.name)), folders: [...plain].sort(), codes, base, shadowed: shadowed.sort() };
}

/** The folders on disk behind a folder of the tree: in every language's folder, and in none. */
export const foldersBehind = (folder: string, onDisk: string[], { original, previous }: ContentLanguages, codes: string[]): string[] =>
  [...new Set([folder, `${original}/${folder}`, ...(previous ? [`${previous}/${folder}`] : []), ...codes.map((c) => `${c}/${folder}`)])].filter((f) => onDisk.includes(f));
