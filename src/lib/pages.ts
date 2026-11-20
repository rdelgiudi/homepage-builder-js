/**
 * Pages of the site (pure, client-safe, unit-tested). The homepage is the config's top-level
 * `tabs`; every entry of `pages` is another page at `/<slug>` with its own tabs. In here the
 * homepage is the page with id "" and slug "".
 *
 * Also the site map: which page links to which, and which pages can't be reached from the
 * homepage by following links (the editor warns about those).
 */
import type { HomepageConfig, PageSettingGroup, PageSettings, Tab } from "@/lib/schema/config";
import { MAX_PAGE_DEPTH } from "@/lib/schema/page-address";

export interface SitePage {
  /** "" for the homepage. */
  id: string;
  /** "" for the homepage, else the address without the leading slash. */
  slug: string;
  title: string;
  tabs: Tab[];
  /** Setting groups this page has of its own (unset groups follow the site's). */
  settings?: PageSettings;
}

type Section = Tab["sections"][number];

export const HOME = "";

export const pagePath = (slug: string) => (slug ? `/${slug}` : "/");

/** The homepage first, then every page in order. */
export function sitePages(config: HomepageConfig): SitePage[] {
  return [
    { id: HOME, slug: HOME, title: "Home", tabs: config.tabs, settings: config.homeSettings },
    ...config.pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, tabs: p.tabs, settings: p.settings })),
  ];
}

export const findPage = (config: HomepageConfig, id: string): SitePage | undefined => sitePages(config).find((p) => p.id === id);
export const findPageBySlug = (config: HomepageConfig, slug: string): SitePage | undefined => sitePages(config).find((p) => p.slug === slug);

/** A page's own settings ("" = the homepage's), or undefined when it has none. */
export function pageSettings(config: HomepageConfig, id: string): PageSettings | undefined {
  return id === HOME ? config.homeSettings : config.pages.find((p) => p.id === id)?.settings;
}

/**
 * One settings group's values as they apply to `config` (the site, or a page's view): for
 * `header` and `titleColors` they are top-level fields, for the rest a nested object.
 */
export function groupValue<G extends PageSettingGroup>(config: HomepageConfig, group: G): NonNullable<PageSettings[G]> {
  const v =
    group === "header"
      ? { name: config.name, tagline: config.tagline }
      : group === "titleColors"
        ? { titleGradient: config.titleGradient, taglineGradient: config.taglineGradient }
        : config[group as "layout" | "counters" | "background" | "effects"];
  return v as NonNullable<PageSettings[G]>;
}

/** Writes one group's values as the site's (top-level fields for header / title colors). */
export function withSiteGroup<G extends PageSettingGroup>(config: HomepageConfig, group: G, value: NonNullable<PageSettings[G]>): HomepageConfig {
  return group === "header" || group === "titleColors" ? { ...config, ...(value as object) } : { ...config, [group]: value };
}

/**
 * The config as one page sees it: that page's tabs as `tabs`, and its own name / title colors /
 * layout / counters / background / effects where it has them (the site's otherwise). This is
 * what the site renders for a page and what the builder and preview use, so they always agree.
 */
export function pageView(config: HomepageConfig, id: string): HomepageConfig {
  const tabs = id === HOME ? config.tabs : config.pages.find((p) => p.id === id)?.tabs ?? [];
  const own = pageSettings(config, id);
  if (!own) return id === HOME ? config : { ...config, tabs };
  return {
    ...config,
    ...own.header,
    ...own.titleColors,
    tabs,
    layout: own.layout ?? config.layout,
    counters: own.counters ?? config.counters,
    background: own.background ?? config.background,
    effects: own.effects ?? config.effects,
  };
}

/**
 * Sets (`value`) or removes (`undefined` = use the site's again) one group of a page's own
 * settings. An empty settings object is removed, so the file stays as it was.
 */
export function withPageSetting<G extends PageSettingGroup>(config: HomepageConfig, id: string, group: G, value: PageSettings[G] | undefined): HomepageConfig {
  const next = { ...(pageSettings(config, id) ?? {}) } as PageSettings;
  if (value === undefined) delete next[group];
  else next[group] = value;
  const settings = Object.keys(next).length ? next : undefined;
  if (id === HOME) {
    const { homeSettings: _old, ...rest } = config;
    return settings ? { ...rest, homeSettings: settings } : (rest as HomepageConfig);
  }
  return {
    ...config,
    pages: config.pages.map((p) => {
      if (p.id !== id) return p;
      const { settings: _old, ...rest } = p;
      return settings ? { ...rest, settings } : rest;
    }),
  };
}

/** Writes one page's tabs back into the config. */
export function withPageTabs(config: HomepageConfig, id: string, tabs: Tab[]): HomepageConfig {
  if (id === HOME) return { ...config, tabs };
  return { ...config, pages: config.pages.map((p) => (p.id === id ? { ...p, tabs } : p)) };
}

export const allTabs = (config: HomepageConfig): Tab[] => sitePages(config).flatMap((p) => p.tabs);
export const allSections = (config: HomepageConfig): Section[] => allTabs(config).flatMap((t) => t.sections);

/** Applies `fn` to every section on every page (returns the same object when nothing changed). */
export function mapSections(config: HomepageConfig, fn: (section: Section) => Section): HomepageConfig {
  const tabs = (list: Tab[]) => list.map((t) => ({ ...t, sections: t.sections.map(fn) }));
  return { ...config, tabs: tabs(config.tabs), pages: config.pages.map((p) => ({ ...p, tabs: tabs(p.tabs) })) };
}

/** Every id in use (pages, tabs, sections): new ids must avoid all of them. */
export function allIds(config: HomepageConfig): Set<string> {
  return new Set([...config.pages.map((p) => p.id), ...allTabs(config).flatMap((t) => [t.id, ...t.sections.map((s) => s.id)])]);
}

/** The page a tab or section belongs to. */
export function pageOf(config: HomepageConfig, id: string): SitePage | undefined {
  return sitePages(config).find((p) => p.tabs.some((t) => t.id === id || t.sections.some((s) => s.id === id)));
}

// --- links ---

/** Single path segments that are the site's own routes, not pages (no "broken link" for them). */
const SITE_ROUTES = new Set(["posts", "overlay", "admin", "api", "ws"]);

/**
 * Which page an address leads to: a page address ("" = the homepage, "about/colophon" for a page
 * under another), or null when it leads somewhere else (another site, a blog post, a file,
 * mailto:…). `from` is the address of the page the link is on: relative links resolve like a
 * browser does (`colophon` on /about/x → about/colophon). `ownHosts` = the site's own host
 * names, so a full `https://my.site/page` counts too.
 */
export function linkTarget(href: string, from: string, ownHosts: readonly string[] = []): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("?")) return null; // the same page
  let url: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) {
      url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      if (!/^https?:$/.test(url.protocol) || !ownHosts.includes(url.host.toLowerCase())) return null;
    } else {
      url = new URL(raw, `http://site.invalid${pagePath(from)}`);
    }
  } catch {
    return null;
  }
  const clean = url.pathname.replace(/\/+$/, "");
  if (clean === "") return "";
  const parts = clean.slice(1).split("/");
  if (parts.length > MAX_PAGE_DEPTH) return null;
  // Only address-shaped levels: /cv.pdf or /docs/logo.png are files, not missing pages.
  if (!parts.every((p) => /^[a-z0-9][a-z0-9-]*$/i.test(p))) return null;
  // Lower case: the site finds /About/Colophon too (addresses are lowercase-only).
  return SITE_ROUTES.has(parts[0].toLowerCase()) ? null : parts.join("/").toLowerCase();
}

/** Addresses in a markdown text: inline links, reference definitions, HTML hrefs and autolinks. */
export function markdownLinks(text: string): string[] {
  const out: string[] = [];
  const add = (re: RegExp) => {
    for (const m of text.matchAll(re)) out.push(m[1]);
  };
  add(/\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g);
  add(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm);
  add(/\bhref\s*=\s*["']([^"']+)["']/gi);
  add(/<((?:https?:)?\/\/[^>\s]+)>/g);
  return out;
}

/** Keys whose string values are links ("url", "linkUrl", "link", "href"). */
const LINK_KEY = /(^|[a-z])(url|link|href)$/i;

/** Every link-like string in a section (nested lists included), with where it was found. */
function sectionLinks(value: unknown, key = ""): string[] {
  if (typeof value === "string") return LINK_KEY.test(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => sectionLinks(v, key));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => sectionLinks(v, k));
  return [];
}

export interface PageLink {
  /** Slug of the page the link is on. */
  from: string;
  /** Slug it leads to. */
  to: string;
  href: string;
  tabId: string;
  sectionId: string;
  sectionType: string;
  /** The markdown file it is in, for links inside a Markdown widget's file. */
  file?: string;
}

export interface SiteMap {
  pages: SitePage[];
  /** Links between pages of this site (including links to pages that don't exist: see `broken`). */
  links: PageLink[];
  /** Slugs reachable from the homepage by following links. */
  reachable: Set<string>;
  /** Pages nobody can get to without typing the address. */
  unreachable: SitePage[];
  /** For the site map tree: the page each reachable page was first found from. */
  parent: Map<string, string>;
  /** Links to a page of this site that doesn't exist. */
  broken: PageLink[];
}

/**
 * Follows links from the homepage (breadth first). `fileLinks` = the addresses in each
 * markdown file a Markdown widget shows (see `markdownLinks`); links inside blog posts don't
 * count, since posts aren't pages.
 */
export function siteMap(config: HomepageConfig, fileLinks: Record<string, string[]> = {}, ownHosts: readonly string[] = []): SiteMap {
  const pages = sitePages(config);
  const slugs = new Set(pages.map((p) => p.slug));
  const links: PageLink[] = [];
  for (const page of pages) {
    for (const tab of page.tabs) {
      for (const section of tab.sections) {
        const where = { from: page.slug, tabId: tab.id, sectionId: section.id, sectionType: section.type };
        const file = section.type === "markdown" ? (section as { file?: string }).file : undefined;
        const found: { href: string; file?: string }[] = [
          ...sectionLinks(section).map((href) => ({ href })),
          ...(file ? (fileLinks[file] ?? []).map((href) => ({ href, file })) : []),
        ];
        for (const { href, file: inFile } of found) {
          const to = linkTarget(href, page.slug, ownHosts);
          if (to !== null) links.push({ ...where, to, href, ...(inFile ? { file: inFile } : {}) });
        }
      }
    }
  }

  const reachable = new Set<string>([HOME]);
  const parent = new Map<string, string>();
  const queue = [HOME];
  while (queue.length) {
    const at = queue.shift()!;
    for (const l of links) {
      if (l.from !== at || !slugs.has(l.to) || reachable.has(l.to)) continue;
      reachable.add(l.to);
      parent.set(l.to, at);
      queue.push(l.to);
    }
  }
  return {
    pages,
    links,
    reachable,
    unreachable: pages.filter((p) => !reachable.has(p.slug)),
    parent,
    broken: links.filter((l) => !slugs.has(l.to)),
  };
}

/**
 * After a page's address changes from `from` to `to`: points every link field that led to it
 * at the new address (query and #anchor kept). Markdown files are left alone: they are live
 * immediately, while the new address only exists after Publish.
 */
export function retargetLinks(config: HomepageConfig, from: string, to: string, ownHosts: readonly string[] = []): HomepageConfig {
  const rewrite = (href: string): string => {
    const v = href.trim();
    if (v.startsWith("/")) return `/${to}${v.slice(1 + from.length)}`;
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(v)) {
      const url = new URL(v.startsWith("//") ? `https:${v}` : v);
      url.pathname = `/${to}`;
      return v.startsWith("//") ? url.toString().slice("https:".length) : url.toString();
    }
    return `${to}${v.slice(from.length)}`;
  };
  const fix = (value: unknown, key: string): unknown => {
    if (typeof value === "string") return LINK_KEY.test(key) && linkTarget(value, "", ownHosts) === from ? rewrite(value) : value;
    if (Array.isArray(value)) return value.map((v) => fix(v, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fix(v, k)]));
    return value;
  };
  return mapSections(config, (s) => fix(s, "") as Section);
}

/** The address a page sits under ("about" for "about/colophon"; "" = the top level). */
export const parentAddress = (slug: string) => (slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : "");

/**
 * Changes a page's address. Pages under it (`<old>/…`) move along, keeping their own last
 * level; link fields that led to any of them follow (retargetLinks). Returns every address
 * that changed, so the panel can name markdown files that still use the old ones.
 */
export function moveAddress(config: HomepageConfig, id: string, to: string, ownHosts: readonly string[] = []): { config: HomepageConfig; moved: { from: string; to: string }[] } {
  const page = config.pages.find((p) => p.id === id);
  if (!page || page.slug === to) return { config, moved: [] };
  const from = page.slug;
  const moved = config.pages.filter((p) => p.slug === from || p.slug.startsWith(`${from}/`)).map((p) => ({ from: p.slug, to: to + p.slug.slice(from.length) }));
  const newSlug = new Map(moved.map((m) => [m.from, m.to]));
  let next: HomepageConfig = { ...config, pages: config.pages.map((p) => (newSlug.has(p.slug) ? { ...p, slug: newSlug.get(p.slug)! } : p)) };
  for (const m of moved) next = retargetLinks(next, m.from, m.to, ownHosts);
  return { config: next, moved };
}
