import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { isWritable } from "@/lib/admin/publish";
import { audit } from "@/lib/admin/store";
import { CONTENT_DIR, resolveContentFile } from "@/lib/content";
import { renderMarkdownToHtml } from "@/lib/markdown";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200_000;
const BAD_NAME = "Use a plain file name ending in .md (letters, numbers, dots, dashes, underscores).";

/** Without `file`: the list of markdown files. With `file`: that file's text. */
export const GET = withAdmin(async (request) => {
  const name = new URL(request.url).searchParams.get("file");
  if (name === null) {
    let files: { name: string; bytes: number; modifiedAt: number }[] = [];
    try {
      files = fs
        .readdirSync(CONTENT_DIR)
        .filter((f) => resolveContentFile(f))
        .map((f) => {
          const stat = fs.statSync(path.join(CONTENT_DIR, f));
          return { name: f, bytes: stat.size, modifiedAt: stat.mtimeMs };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {}
    return NextResponse.json({ files, writable: isWritable(CONTENT_DIR) });
  }

  const filePath = resolveContentFile(name);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  try {
    return NextResponse.json({ name, content: fs.readFileSync(filePath, "utf-8") });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
});

/** Creates or overwrites a markdown file. Content is live as soon as it is saved. */
export const PUT = withAdmin(async (request) => {
  const body = await readJson<{ file?: unknown; content?: unknown }>(request);
  const filePath = resolveContentFile(typeof body?.file === "string" ? body.file : null);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  if (typeof body?.content !== "string") return NextResponse.json({ error: "Missing content." }, { status: 400 });
  if (Buffer.byteLength(body.content) > MAX_BYTES) return NextResponse.json({ error: "File is too large (200 KB max)." }, { status: 413 });

  try {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    fs.writeFileSync(filePath, body.content);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      return NextResponse.json({ error: "src/content is not writable. If you run in Docker, mount it without :ro." }, { status: 500 });
    }
    throw err;
  }
  audit("content.save", body.file as string);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (request) => {
  const name = new URL(request.url).searchParams.get("file");
  const filePath = resolveContentFile(name);
  if (!filePath) return NextResponse.json({ error: BAD_NAME }, { status: 400 });
  fs.rmSync(filePath, { force: true });
  audit("content.delete", name);
  return NextResponse.json({ ok: true });
});

/** Renders markdown the same way the public site does, for the editor's preview. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ markdown?: unknown }>(request);
  if (typeof body?.markdown !== "string") return NextResponse.json({ error: "Missing markdown." }, { status: 400 });
  return NextResponse.json({ html: renderMarkdownToHtml(matter(body.markdown).content) });
});
