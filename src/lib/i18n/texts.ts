/**
 * The owner's texts in a config: which fields are text (`translate` in the zod schemas' meta),
 * applying a language's translations, and keeping translations attached while the original is
 * edited. Uses the schemas (zod), so it is for the server and the admin panel, never the site's
 * client bundle. Unit-tested in tests/unit/i18n.test.ts.
 *
 * A translation belongs to a text in a **place** (`texts[place][text]`): the widget (or tab, page,
 * site) and the field, e.g. "section:my-links.items.label". The same text elsewhere is another
 * decision, because it may mean something else there; its translation is only offered
 * (suggest.ts). The position in a list is not part of it: items have no ids, and a position
 * would silently attach a translation to another item after a reorder.
 */
import { z } from "zod";
import { ConfigSchema, PageSchema, TabSchema, type HomepageConfig, type TextEntry, type Translation } from "@/lib/schema/config";
import { SHARED, sharedTranslation } from "@/lib/schema/migrate";
import { HOME, sitePages } from "@/lib/pages";
import { widgetMetas } from "@/widgets/meta";

interface Node {
  type?: string;
  title?: string;
  ui?: string;
  /**
   * `true` = text to translate. `"name"` = the same, but usually a name (of a person, a place, a
   * project, a tool): never "missing"; the panel asks to confirm that it stays as it is.
   * `"labels"` = the text (or every text of a list) is also a key (poll options: votes are stored by them; a notice: dismissals are), so it stays as it is and
   * the translation goes into `<key>Labels`.
   */
  translate?: true | "name" | "labels";
  /** The same place as this sibling field: texts that must match each other (game shelf groups and their order). */
  translateAs?: string;
  properties?: Record<string, Node>;
  items?: Node;
}

const toNode = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input" }) as Node;
const configNode = toNode(ConfigSchema);
const tabNode = toNode(TabSchema.omit({ sections: true }));
const pageNode = toNode(PageSchema.omit({ tabs: true, settings: true }));
const headerNode: Node = { type: "object", properties: { name: configNode.properties!.name, tagline: configNode.properties!.tagline } };
const siteNode: Node = { type: "object", properties: { ...headerNode.properties, postAuthor: configNode.properties!.postAuthor } };
/** Every widget type's options, as JSON Schema with the zod meta. */
export const widgetNodes = new Map(widgetMetas.map((m) => [m.type as string, toNode(m.schema)]));

/** Nothing to translate in "98%", "🎮" or "2026". */
const hasWords = (s: string) => /\p{L}/u.test(s);

type Visit = (text: string, at: { path: string; place: string; title: string; long: boolean; name: boolean }) => string;

/** Rebuilds `value`, replacing every translatable text by what `visit` returns for it. */
function walk(node: Node | undefined, value: unknown, path: string, visit: Visit, place = path): unknown {
  if (!node) return value;
  if (typeof value === "string") return node.translate && hasWords(value) ? visit(value, { path, place, title: node.title ?? "Text", long: node.ui === "textarea", name: node.translate === "name" }) : value;
  if (Array.isArray(value)) {
    const item: Node = { ...node.items, ...(node.translate && { translate: node.translate, title: node.title }) };
    return value.map((v, i) => walk(item, v, `${path}.${i}`, visit, place));
  }
  if (value && typeof value === "object" && node.properties) {
    const out: Record<string, unknown> = { ...(value as object) };
    for (const [key, child] of Object.entries(node.properties)) {
      if (out[key] === undefined) continue;
      const next = walk(child, out[key], `${path}.${key}`, visit, `${place}.${child.translateAs ?? key}`);
      if (child.translate === "labels") out[`${key}Labels`] = next;
      else out[key] = next;
    }
    return out;
  }
  return value;
}

export interface TextUse {
  text: string;
  /** Stable while ids are ("<section id>.items.0.label"). */
  path: string;
  /** The path without positions in lists: what a translation belongs to, with the text. */
  place: string;
  /** The field's name in the panel. */
  title: string;
  long: boolean;
  /** Usually a name: may well not translate. */
  name: boolean;
  /** Where it is, for the panel. Unset parts = the site's or the page's own texts. */
  pageId: string | null;
  tabId?: string;
  sectionId?: string;
}

function visitConfig(config: HomepageConfig, visit: (use: TextUse) => string): HomepageConfig {
  const at = (where: Pick<TextUse, "pageId" | "tabId" | "sectionId">): Visit => (text, a) => visit({ text, path: a.path, place: a.place, title: a.title, long: a.long, name: a.name, ...where });
  const header = <T extends { header?: unknown } | undefined>(settings: T, pageId: string): T =>
    settings?.header ? { ...settings, header: walk(headerNode, settings.header, `page:${pageId}.header`, at({ pageId })) } : settings;

  const tabs = (list: HomepageConfig["tabs"], pageId: string): HomepageConfig["tabs"] =>
    list.map((tab) => {
      const { sections, ...rest } = tab;
      const own = walk(tabNode, rest, `tab:${tab.id}`, at({ pageId, tabId: tab.id })) as typeof rest;
      return {
        ...own,
        // Its address in `?tab=` must not change with the language (lib/tab-slug.ts).
        ...(own.label !== tab.label && { sourceLabel: tab.label }),
        sections: sections.map((s) => walk(widgetNodes.get(s.type), s, `section:${s.id}`, at({ pageId, tabId: tab.id, sectionId: s.id })) as typeof s),
      };
    });

  const { homeSettings } = config;
  return {
    ...config,
    ...(walk(siteNode, { name: config.name, tagline: config.tagline, postAuthor: config.postAuthor }, "site", at({ pageId: null })) as object),
    ...(homeSettings && { homeSettings: header(homeSettings, HOME) }),
    tabs: tabs(config.tabs, HOME),
    pages: config.pages.map((page) => {
      const { tabs: pageTabs, settings, ...rest } = page;
      const own = walk(pageNode, rest, `page:${page.id}`, at({ pageId: page.id })) as typeof rest;
      return { ...own, ...(settings && { settings: header(settings, page.id) }), tabs: tabs(pageTabs, page.id) };
    }),
  };
}

const collected = new WeakMap<HomepageConfig, TextUse[]>();

/** Every text of the site, in page order. */
export function collectTexts(config: HomepageConfig): TextUse[] {
  const known = collected.get(config);
  if (known) return known;
  const uses: TextUse[] = [];
  visitConfig(config, (use) => {
    uses.push(use);
    return use.text;
  });
  collected.set(config, uses);
  return uses;
}

/** `texts` comes from JSON: "constructor" must not find Object's. */
export function entryOf(t: Translation, place: string, text: string): TextEntry | undefined {
  const here = Object.hasOwn(t.texts, place) ? t.texts[place] : undefined;
  return here && Object.hasOwn(here, text) ? here[text] : undefined;
}

/** Sets (or, for `undefined`, removes) what was decided for one text in one place. */
export function withEntry(t: Translation, place: string, text: string, entry: TextEntry | undefined): Translation {
  const here = { ...(Object.hasOwn(t.texts, place) ? t.texts[place] : null) };
  if (entry && (entry.to || entry.same)) here[text] = entry;
  else delete here[text];
  const texts = { ...t.texts, [place]: here };
  if (!Object.keys(here).length) delete texts[place];
  return { ...t, texts };
}

const translated = (entry: TextEntry | undefined) => (entry?.to?.trim() ? entry.to : undefined);

/** Place of shared translations (see `expandShared`) whose text is nowhere on the site. */
const UNUSED = "(unused)";

/**
 * Gives translations written without a place (hand-written files, see `sharedTranslation`) to
 * every place that has their text now and no decision of its own.
 */
export function expandShared(config: HomepageConfig): HomepageConfig {
  const translations = config.languages.translations.map((raw) => {
    // Also in the panel: one that was open while the code was updated still holds the old shape.
    const t = sharedTranslation(raw) as Translation;
    if (!Object.hasOwn(t.texts, SHARED)) return t;
    const { [SHARED]: shared, ...texts } = t.texts;
    let next: Translation = { ...t, texts };
    const used = new Set<string>();
    for (const { place, text } of collectTexts(config)) {
      if (!Object.hasOwn(shared, text)) continue;
      used.add(text);
      if (!entryOf(next, place, text)) next = withEntry(next, place, text, shared[text]);
    }
    for (const [text, entry] of Object.entries(shared)) if (!used.has(text)) next = withEntry(next, UNUSED, text, entry);
    return next;
  });
  if (translations.every((t, i) => t === config.languages.translations[i])) return config;
  return { ...config, languages: { ...config.languages, translations } };
}

const localized = new WeakMap<HomepageConfig, Map<string, HomepageConfig>>();

/** The config with one language's translations applied; texts without one stay in the original. */
export function localize(config: HomepageConfig, code: string): HomepageConfig {
  const t = config.languages.translations.find((l) => l.code === code);
  if (!t) return config;
  let byCode = localized.get(config);
  if (!byCode) localized.set(config, (byCode = new Map()));
  const known = byCode.get(code);
  if (known) return known;
  const next = visitConfig(config, (use) => translated(entryOf(t, use.place, use.text)) ?? use.text);
  byCode.set(code, next);
  return next;
}

/** A text in a place, once, with what was decided for it in one language. */
export interface TextRow {
  key: string;
  use: TextUse;
  value: string;
  same: boolean;
  /** `name` = undecided, but usually a name: translate it, or confirm that it stays. `edited` = decided, then the original was edited. */
  state: "missing" | "name" | "edited" | "done";
}

const keyOf = (place: string, text: string) => `${place}\n${text}`;

export interface TranslationStatus {
  rows: TextRow[];
  total: number;
  /** Translated or confirmed (also when edited since). */
  decided: number;
  count: Record<TextRow["state"], number>;
  /** Decisions about texts that are no longer there. */
  stale: { place: string; text: string; to: string }[];
}

export function translationStatus(config: HomepageConfig, t: Translation): TranslationStatus {
  const rows = new Map<string, TextRow>();
  for (const use of collectTexts(config)) {
    const key = keyOf(use.place, use.text);
    if (rows.has(key)) continue;
    const entry = entryOf(t, use.place, use.text);
    const value = translated(entry) ?? "";
    const same = !value && !!entry?.same;
    rows.set(key, { key, use, value, same, state: !value && !same ? (use.name ? "name" : "missing") : entry?.check ? "edited" : "done" });
  }
  const count = { missing: 0, name: 0, edited: 0, done: 0 };
  for (const row of rows.values()) count[row.state]++;
  const stale = Object.entries(t.texts).flatMap(([place, here]) =>
    Object.entries(here).flatMap(([text, entry]) => (rows.has(keyOf(place, text)) ? [] : [{ place, text, to: entry.to ?? "" }]))
  );
  return { rows: [...rows.values()], total: rows.size, decided: count.edited + count.done, count, stale };
}

/**
 * Keeps decisions attached to a text that was edited: where a text is gone from a place and the
 * same position holds one that is new to that place, its translation (or "doesn't translate")
 * moves to the new text and is marked to check. Reordering, moving and deleting change nothing
 * (their texts aren't new).
 */
export function carryTranslations(prev: HomepageConfig, next: HomepageConfig): HomepageConfig {
  const { translations } = next.languages;
  if (!translations.length || translations !== prev.languages.translations) return next;
  const before = collectTexts(prev);
  const after = collectTexts(next);
  const had = new Set(before.map((u) => keyOf(u.place, u.text)));
  const has = new Set(after.map((u) => keyOf(u.place, u.text)));
  const now = new Map(after.map((u) => [u.path, u.text]));
  const renamed = before.flatMap(({ path, place, text }) => {
    const to = now.get(path);
    return to !== undefined && to !== text && !has.has(keyOf(place, text)) && !had.has(keyOf(place, to)) ? [{ place, text, to }] : [];
  });
  if (!renamed.length) return next;
  return {
    ...next,
    languages: {
      ...next.languages,
      translations: translations.map((t) =>
        renamed.reduce((acc, { place, text, to }) => {
          const entry = entryOf(acc, place, text);
          if (!entry || entryOf(acc, place, to)) return acc;
          return withEntry(withEntry(acc, place, text, undefined), place, to, { ...entry, check: true });
        }, t)
      ),
    },
  };
}

/** "Home › Start" for a text's place (the panel's group headings). */
export function placeOf(config: HomepageConfig, use: Pick<TextUse, "pageId" | "tabId">): string {
  if (use.pageId === null) return "Whole site";
  const page = sitePages(config).find((p) => p.id === use.pageId);
  const tab = page?.tabs.find((t) => t.id === use.tabId);
  return [page?.title ?? "", tab?.label].filter(Boolean).join(" › ");
}
