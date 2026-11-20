/** The Content screen's folder tree (pure, unit-tested). Paths are relative to src/content, with `/`. */

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
