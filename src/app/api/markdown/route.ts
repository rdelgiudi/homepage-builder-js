import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { renderMarkdownToHtml } from "@/lib/markdown";

export const revalidate = 300;

const CONTENT_DIR = path.join(process.cwd(), "src", "content");
const cache = new Map<string, { mtimeMs: number; html: string }>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file specified" }, { status: 400 });
  }

  const filePath = path.join(CONTENT_DIR, file);

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const cached = cache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return NextResponse.json(
      { html: cached.html },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { content } = matter(fileContent);
    const html = renderMarkdownToHtml(content);
    cache.set(filePath, { mtimeMs: stat.mtimeMs, html });
    return NextResponse.json(
      { html },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (err) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
