/**
 * Blog posts = markdown files in src/content/ whose front matter has a `date`. They are
 * listed by the `posts` widget and each one is a page at /posts/<file name without .md>.
 * Files without a date stay plain content files (for the markdown widget); `draft: true`
 * hides a post. Everything is read at request time and cached per file by mtime.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { CONTENT_DIR, resolveContentFile } from "@/lib/content";
import { renderMarkdownToHtml } from "@/lib/markdown";

export interface PostSummary {
  slug: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
  tags: string[];
  minutes: number;
}

export interface Post extends PostSummary {
  html: string;
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,77}$/;

/** gray-matter turns an unquoted YAML date into a Date; a quoted one stays a string. */
export function postDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) return value.trim().slice(0, 10);
  return null;
}

/** Plain-text start of the body, for posts without a `summary`. */
export function excerpt(markdown: string, max = 180): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, " ") // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ") // horizontal rules
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, " ") // list markers
    .replace(/[*_`>#~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}

/** Turns parsed front matter + body into a post, or null when it isn't one. */
export function toPost(slug: string, data: Record<string, unknown>, body: string): Omit<Post, "html"> | null {
  const date = postDate(data.date);
  if (!date || data.draft === true) return null;
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug.replace(/[-_]+/g, " ");
  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : excerpt(body);
  const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim()) : [];
  const words = body.split(/\s+/).filter(Boolean).length;
  return { slug, title, date, summary, tags, minutes: Math.max(1, Math.round(words / 220)) };
}

const cache = new Map<string, { mtimeMs: number; post: Omit<Post, "html"> | null; body: string; html?: string }>();

function load(slug: string): { mtimeMs: number; post: Omit<Post, "html"> | null; body: string; html?: string } | null {
  if (!SLUG.test(slug)) return null;
  const file = resolveContentFile(`${slug}.md`);
  if (!file) return null;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  const hit = cache.get(slug);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit;
  try {
    // A fresh object each time: gray-matter caches its result by input string.
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const entry = { mtimeMs: stat.mtimeMs, post: toPost(slug, data as Record<string, unknown>, content), body: content };
    cache.set(slug, entry);
    return entry;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Posts] ${slug}.md:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Every published post, newest first. */
export function listPosts(): PostSummary[] {
  let names: string[];
  try {
    names = fs.readdirSync(CONTENT_DIR);
  } catch {
    return [];
  }
  const posts = names.flatMap((name) => {
    if (!name.endsWith(".md")) return [];
    const post = load(path.basename(name, ".md"))?.post;
    return post ? [post] : [];
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function getPost(slug: string): Post | null {
  const entry = load(slug);
  if (!entry?.post) return null;
  entry.html ??= renderMarkdownToHtml(entry.body);
  return { ...entry.post, html: entry.html };
}

/** Widget endpoint: the list, optionally only posts with a tag. */
export async function posts(p: URLSearchParams): Promise<{ posts: PostSummary[] }> {
  const tag = (p.get("tag") ?? "").trim().toLowerCase();
  const all = listPosts();
  return { posts: tag ? all.filter((post) => post.tags.some((t) => t.toLowerCase() === tag)) : all };
}
