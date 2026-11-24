/**
 * Blog posts = markdown files in src/content/ (folders included) whose front matter has a
 * `date`. They are listed by the `posts` widget and each one is a page at
 * /posts/<path without .md> ("blog/2026/hello.md" → /posts/blog/2026/hello; a language's folder
 * isn't part of it).
 * Files without a date stay plain content files (for the markdown widget); `draft: true`
 * hides a post; `author` overrides the site's `postAuthor`. Everything is read at request time and cached per file by mtime.
 */
import fs from "fs";
import matter from "gray-matter";
import { getConfig } from "@/lib/config";
import { listContent, resolveContentFile } from "@/lib/content";
import { LANGUAGE_CODE, contentCandidates, contentLanguages, contentPlace, isOriginal, type ContentLanguages } from "@/lib/i18n/languages";
import { renderMarkdownToHtml } from "@/lib/markdown";

export interface PostSummary {
  slug: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
  tags: string[];
  minutes: number;
  /** Front matter `author`; unset = the site's `postAuthor` (applied where it is shown). */
  author?: string;
}

export interface Post extends PostSummary {
  html: string;
}


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
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : (slug.split("/").pop() ?? slug).replace(/[-_]+/g, " ");
  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : excerpt(body);
  const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim()) : [];
  const words = body.split(/\s+/).filter(Boolean).length;
  const author = typeof data.author === "string" && data.author.trim() ? data.author.trim() : undefined;
  return { slug, title, date, summary, tags, minutes: Math.max(1, Math.round(words / 220)), ...(author && { author }) };
}

interface Entry {
  mtimeMs: number;
  post: Omit<Post, "html"> | null;
  data: Record<string, unknown>;
  body: string;
  html?: string;
}
const cache = new Map<string, Entry>();

function load(slug: string): Entry | null {
  // The file's path without ".md" (its language folder included); resolveContentFile checks every part of it.
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
    const entry: Entry = { mtimeMs: stat.mtimeMs, post: toPost(slug, data as Record<string, unknown>, content), data: data as Record<string, unknown>, body: content };
    cache.set(slug, entry);
    return entry;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Posts] ${slug}.md:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * A post in a language. `name` = the file without its language folder. The text is the
 * language's (a translation marked `draft: true` isn't used yet), else the original's, else any.
 * Its front matter is merged over the first version that is a complete post (has a date), so a
 * translation only needs what differs; after the main language was swapped with a translation,
 * that version may be a translation. An original that is a draft hides the post everywhere.
 */
function inLanguage(name: string, languages: ContentLanguages, lang: string | undefined): { post: Omit<Post, "html">; entry: Entry } | null {
  const slug = name.slice(0, -".md".length);
  const versions = contentCandidates(name, languages).flatMap((file) => load(file.slice(0, -".md".length)) ?? []);
  const [main] = versions;
  const base = versions.find((v) => v.post);
  if (!main || main.data.draft === true || !base?.post) return null;
  const own = lang && lang !== languages.original && LANGUAGE_CODE.test(lang) ? load(`${lang}/${slug}`) : null;
  const shown = own && own.data.draft !== true ? own : main;
  if (shown === base) return { post: { ...base.post, slug }, entry: base };
  // The other version's summary would be in the wrong language: an excerpt of this one is better.
  const { summary: _summary, ...shared } = base.data;
  const post = toPost(slug, { ...shared, ...shown.data }, shown.body);
  return post ? { post, entry: shown } : { post: { ...base.post, slug }, entry: base };
}

/** Every published post, newest first; in `lang` where it has a translation ("it/hello.md" for "en/hello.md"). */
export function listPosts(lang?: string): PostSummary[] {
  const languages = contentLanguages(getConfig().languages);
  const files = new Set(listContent().files.map((f) => f.name));
  // One post per name, whatever languages it is in.
  const names = new Set([...files].map((file) => contentPlace(file, languages, files).name));
  const posts = [...names].flatMap((name) => inLanguage(name, languages, lang)?.post ?? []);
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** `languages`: the site's, or the draft's in the admin preview. */
export function getPost(slug: string, lang?: string, languages: ContentLanguages = contentLanguages(getConfig().languages)): Post | null {
  const name = `${slug}.md`;
  if (!resolveContentFile(name)) return null;
  const asked = contentPlace(name, languages, new Set(listContent().files.map((f) => f.name)));
  // A translation has no address of its own.
  const found = isOriginal(asked, languages) ? inLanguage(asked.name, languages, lang) : null;
  if (!found) return null;
  found.entry.html ??= renderMarkdownToHtml(found.entry.body);
  return { ...found.post, html: found.entry.html };
}

/** Widget endpoint: the list, optionally only posts with a tag. */
export async function posts(p: URLSearchParams): Promise<{ posts: PostSummary[] }> {
  const tag = (p.get("tag") ?? "").trim().toLowerCase();
  const all = listPosts(p.get("lang") ?? undefined);
  return { posts: tag ? all.filter((post) => post.tags.some((t) => t.toLowerCase() === tag)) : all };
}
