import path from "path";

export const CONTENT_DIR = path.join(process.cwd(), "src", "content");

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.md$/;

/**
 * Maps a user-supplied markdown file name to its path inside CONTENT_DIR, or `null` if
 * the name is not a plain `*.md` file name (no directories, no traversal).
 */
export function resolveContentFile(name: string | null | undefined): string | null {
  if (!name || !FILE_NAME.test(name)) return null;
  const resolved = path.join(CONTENT_DIR, name);
  return path.dirname(resolved) === CONTENT_DIR ? resolved : null;
}
