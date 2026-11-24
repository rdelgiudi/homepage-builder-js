/**
 * Languages: codes, names, which one a visitor gets, and where translated markdown files
 * are. Pure and client-safe (no zod, no fs), unit-tested in tests/unit/i18n.test.ts.
 */

/** A language code: `it`, `pt-BR`. */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

/** Offered in the panel (any other valid code can be typed). */
export const COMMON_LANGUAGES = [
  "en", "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "et", "eu", "fa", "fi", "fr", "ga", "gl", "he", "hi", "hr", "hu", "id", "is", "it", "ja", "ka", "ko", "lt", "lv", "ms", "nb", "nl", "pl", "pt", "pt-BR",
  "ro", "ru", "sk", "sl", "sq", "sr", "sv", "th", "tr", "uk", "vi", "zh", "zh-TW",
];

const RTL = new Set(["ar", "fa", "he", "ur", "ps", "yi", "dv", "ckb"]);
export const isRtl = (code: string) => RTL.has(code.split("-")[0]);

/** A language's name, in itself by default ("Italiano"), or in `inLanguage`. */
export function languageName(code: string, inLanguage = code): string {
  try {
    const name = new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(inLanguage) + name.slice(1);
  } catch {
    return code;
  }
}

export interface LanguageChoice {
  code: string;
  /** In the language itself. */
  name: string;
  /** For the small button: "IT", or the region ("BR") where two choices share a language. */
  short: string;
}

export function languageChoices(codes: string[]): LanguageChoice[] {
  const base = (code: string) => code.split("-")[0];
  return codes.map((code) => {
    const shared = codes.filter((c) => base(c) === base(code)).length > 1;
    return { code, name: languageName(code), short: (shared ? (code.split("-")[1] ?? code) : base(code)).toUpperCase() };
  });
}

/** What the site and its picker need to know: the language shown, and the ones to choose from (original first). */
export interface SiteLanguage {
  current: string;
  original: string;
  /** Fewer than two = no picker. */
  choices: LanguageChoice[];
}

/** The available language an `Accept-Language` header asks for, in the visitor's order; null = none of them. */
export function acceptedLanguage(header: string | null | undefined, available: string[]): string | null {
  const wanted = (header ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => /^\s*q=([\d.]+)/.exec(p)?.[1]).find(Boolean);
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), i };
    })
    .filter((w) => w.tag && w.tag !== "*" && w.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of wanted) {
    const exact = available.find((c) => c.toLowerCase() === tag);
    if (exact) return exact;
    const base = tag.split("-")[0];
    const same = available.find((c) => c.toLowerCase() === base) ?? available.find((c) => c.toLowerCase().split("-")[0] === base);
    if (same) return same;
  }
  return null;
}

/** Which language to show: asked for in the address, chosen before, the browser's (if `accept` is passed), else the original. */
export function pickLanguage(available: string[], original: string, asked: { query?: string | null; cookie?: string | null; accept?: string | null }): string {
  for (const code of [asked.query, asked.cookie]) {
    const match = code && available.find((c) => c.toLowerCase() === code.toLowerCase());
    if (match) return match;
  }
  return acceptedLanguage(asked.accept, available) ?? original;
}

// ---- markdown files: one folder per language
// A content file's name ("blog/hello.md": what widgets and post addresses use) never has the
// language in it. On disk the originals are in the original's folder ("en/blog/hello.md") once
// the site is published with a translation, and a translation is at the same place in its own
// folder ("it/blog/hello.md"). A file that isn't in any language's folder is an original too (a
// site in one language, or not moved yet). What isn't there in a language is shown in the
// original, and what isn't there in the original (after the main language was swapped with a
// translation) in whichever language has it.

export interface ContentLanguages {
  original: string;
  /** The translations' codes. */
  codes: string[];
  /**
   * Only in the panel, while the draft changes the original: the published one, whose folder the
   * originals are in until the change is published. Not when it has become a translation.
   */
  previous?: string;
}

export function contentLanguages(l: { original: string; translations: { code: string }[] }, published?: string): ContentLanguages {
  const codes = l.translations.map((t) => t.code);
  return { original: l.original, codes, ...(published && published !== l.original && !codes.includes(published) && { previous: published }) };
}

/**
 * What a file on disk is: its name without the language folder, and its language (`null` = not
 * in a language's folder). A folder named like a common language the site doesn't have (yet)
 * counts only for a file that has an original: files are live when they are saved, before their
 * language is published, and a folder may just be called "it".
 */
export function contentPlace(file: string, { original, codes, previous }: ContentLanguages, files: Set<string>): { name: string; code: string | null } {
  const slash = file.indexOf("/");
  const folder = slash > 0 ? file.slice(0, slash) : "";
  const rest = file.slice(slash + 1);
  const hasOriginal = () => files.has(rest) || files.has(`${original}/${rest}`) || (!!previous && files.has(`${previous}/${rest}`));
  if (folder && (folder === original || folder === previous || codes.includes(folder) || (COMMON_LANGUAGES.includes(folder) && hasOriginal()))) return { name: rest, code: folder };
  return { name: file, code: null };
}

/** An original (in its folder or in none), not a translation. */
export const isOriginal = (place: { code: string | null }, { original, previous }: ContentLanguages) => place.code === null || place.code === original || place.code === previous;

/** Where a file may be, best first: in `lang`, then the original, then any other language. */
export function contentCandidates(file: string, { original, codes, previous }: ContentLanguages, lang?: string | null): string[] {
  const named = [original, previous].find((c) => c && file.startsWith(`${c}/`)); // written with its folder, e.g. by hand
  const name = named ? file.slice(named.length + 1) : file;
  const inFolder = `${original}/${name}`;
  return [
    ...new Set([
      ...(lang && lang !== original && LANGUAGE_CODE.test(lang) ? [`${lang}/${name}`] : []),
      // In one language a folder called "en" may be any folder: the plain name comes first.
      ...(named || codes.length ? [inFolder, ...(previous ? [`${previous}/${name}`] : []), name] : [name, inFolder, ...(previous ? [`${previous}/${name}`] : [])]),
      ...codes.map((c) => `${c}/${name}`),
    ]),
  ];
}

/** Cookie with a visitor's choice (path /), and the preview's own (path /admin, set by the panel). */
export const LANGUAGE_COOKIE = "lang";
export const PREVIEW_LANGUAGE_COOKIE = "preview_lang";
