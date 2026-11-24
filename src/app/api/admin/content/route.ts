import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/store";
import { CONTENT_DIR, MAX_FOLDER_DEPTH, findContentFile, listContent, resolveContentFile, resolveContentFolder } from "@/lib/content";
import { contentLanguages, contentPlace, type ContentLanguages } from "@/lib/i18n/languages";
import { removeEmptyFolders } from "@/lib/i18n/organize";
import { getConfig } from "@/lib/config";
import { getDraftConfig, isWritable } from "@/lib/admin/publish";
import { renderMarkdownToHtml } from "@/lib/markdown";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200_000;
const BAD_NAME = `Use a file name ending in .md, optionally inside folders ("blog/hello.md"): letters, numbers, dots, dashes and underscores, at most ${MAX_FOLDER_DEPTH} folders deep.`;
const BAD_FOLDER = `Use a folder name made of letters, numbers, dots, dashes and underscores ("blog" or "blog/2026"), at most ${MAX_FOLDER_DEPTH} levels deep.`;

/** Turns a write error on a read-only mount into a message that says what to fix. */
function writeError(err: unknown) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
    return NextResponse.json({ error: "src/content is not writable. If you run in Docker, mount it without :ro." }, { status: 500 });
  }
  throw err;
}

const languages = (): ContentLanguages => contentLanguages((getDraftConfig() ?? getConfig()).languages, getConfig().languages.original);

/**
 * Without `file`: every markdown file and folder. With `file`: that file's text; a name without
 * its language folder (as widgets use it) finds the original.
 */
export const GET = withAdmin(async (request) => {
  const name = new URL(request.url).searchParams.get("file");
  if (name === null) return NextResponse.json({ ...listContent(), writable: isWritable(CONTENT_DIR) });

  let filePath = resolveContentFile(name);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  if (!fs.existsSync(filePath)) filePath = findContentFile(name, languages())?.path ?? filePath;
  try {
    return NextResponse.json({ name, content: fs.readFileSync(filePath, "utf-8") });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
});

/**
 * `{ file, content }` creates or overwrites a markdown file (its folders are created too); live
 * as soon as it is saved. `{ folder }` creates an empty folder.
 */
export const PUT = withAdmin(async (request) => {
  const body = await readJson<{ file?: unknown; content?: unknown; folder?: unknown }>(request);

  if (body?.folder !== undefined) {
    const dir = resolveContentFolder(typeof body.folder === "string" ? body.folder : null);
    if (!dir) return NextResponse.json({ error: BAD_FOLDER }, { status: 400 });
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      return writeError(err);
    }
    audit("content.folder", body.folder as string);
    return NextResponse.json({ ok: true });
  }

  const filePath = resolveContentFile(typeof body?.file === "string" ? body.file : null);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  if (typeof body?.content !== "string") return NextResponse.json({ error: "Missing content." }, { status: 400 });
  if (Buffer.byteLength(body.content) > MAX_BYTES) return NextResponse.json({ error: "File is too large (200 KB max)." }, { status: 413 });

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, body.content);
  } catch (err) {
    return writeError(err);
  }
  audit("content.save", body.file as string);
  return NextResponse.json({ ok: true });
});

/**
 * Renames or moves a file or a folder: `{ from, to }`, both files or both folders. A file's
 * other languages ("it/about.md" for "en/about.md") move with it. Answers with
 * every file that moved (`moved: [{ from, to }]`), so the panel can point widgets at the new names.
 */
export const PATCH = withAdmin(async (request) => {
  const body = await readJson<{ from?: unknown; to?: unknown }>(request);
  const from = typeof body?.from === "string" ? body.from : "";
  const to = typeof body?.to === "string" ? body.to : "";
  const isFile = from.endsWith(".md");
  const src = isFile ? resolveContentFile(from) : resolveContentFolder(from);
  const dest = isFile ? resolveContentFile(to) : resolveContentFolder(to);
  if (!src) return NextResponse.json({ error: isFile ? BAD_NAME : BAD_FOLDER }, { status: 400 });
  if (!dest) return NextResponse.json({ error: isFile ? BAD_NAME : BAD_FOLDER }, { status: 400 });
  if (from === to) return NextResponse.json({ ok: true, moved: [] });
  if (!fs.existsSync(src)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (fs.existsSync(dest)) return NextResponse.json({ error: `${to} already exists.` }, { status: 409 });

  const moved: { from: string; to: string }[] = [{ from, to }];
  if (!isFile) {
    if (to.startsWith(`${from}/`)) return NextResponse.json({ error: "A folder can't be moved into itself." }, { status: 400 });
    // Everything inside must still be a valid path at its new depth.
    const inner = listContent(from).files.map((f) => f.name.slice(from.length + 1));
    moved.splice(0, 1, ...inner.map((rel) => ({ from: `${from}/${rel}`, to: `${to}/${rel}` })));
    const tooDeep = moved.find((m) => !resolveContentFile(m.to));
    if (tooDeep) return NextResponse.json({ error: `That would put ${tooDeep.to} more than ${MAX_FOLDER_DEPTH} folders deep.` }, { status: 400 });
  }

  // The other languages' versions go to the same new place in their own folders.
  const langs = languages();
  const files = new Set(listContent().files.map((f) => f.name));
  const places = [...files].map((name) => ({ name, place: contentPlace(name, langs, files) }));
  let translations = moved.flatMap((m) => {
    const was = contentPlace(m.from, langs, files);
    const now = contentPlace(m.to, langs, files);
    if (was.name === now.name) return [];
    return places.filter((p) => p.place.name === was.name && p.name !== m.from).map((p) => ({ from: p.name, to: p.place.code ? `${p.place.code}/${now.name}` : now.name }));
  });
  const inMove = new Set(moved.map((m) => m.from));
  translations = translations.filter((t) => !inMove.has(t.from));
  for (const t of translations) {
    const target = resolveContentFile(t.to);
    if (!target) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
    if (fs.existsSync(target)) return NextResponse.json({ error: `${t.to} already exists.` }, { status: 409 });
  }
  moved.push(...translations);

  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    for (const t of translations) {
      const source = resolveContentFile(t.from)!;
      const target = resolveContentFile(t.to)!;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(source, target);
      removeEmptyFolders(path.dirname(source));
    }
  } catch (err) {
    return writeError(err);
  }
  audit("content.move", `${from} → ${to}`);
  return NextResponse.json({ ok: true, moved });
});

/** `?file=` deletes a file; `?folder=` deletes a folder with everything in it. */
export const DELETE = withAdmin(async (request) => {
  const params = new URL(request.url).searchParams;
  const folder = params.get("folder");
  if (folder !== null) {
    const dir = resolveContentFolder(folder);
    if (!dir) return NextResponse.json({ error: BAD_FOLDER }, { status: 400 });
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      return writeError(err);
    }
    audit("content.delete", `${folder}/`);
    return NextResponse.json({ ok: true });
  }
  const name = params.get("file");
  const filePath = resolveContentFile(name);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  try {
    fs.rmSync(filePath, { force: true });
  } catch (err) {
    return writeError(err);
  }
  audit("content.delete", name);
  return NextResponse.json({ ok: true });
});

/** Renders markdown the same way the public site does, for the editor's preview. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ markdown?: unknown }>(request);
  if (typeof body?.markdown !== "string") return NextResponse.json({ error: "Missing markdown." }, { status: 400 });
  return NextResponse.json({ html: renderMarkdownToHtml(matter(body.markdown).content) });
});
