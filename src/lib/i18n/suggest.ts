/**
 * Translation suggestions for the Languages screen (pure, unit-tested): what was decided for the
 * same text elsewhere, or for one that only differs in case, spacing or the characters around it
 * ("HOME", "Home:", "🏠 Home"). Never applied by itself: the owner confirms each one.
 */
import type { TextEntry, Translation } from "@/lib/schema/config";

/** A text's words, and what stands before and after them (emoji, punctuation, spaces). */
function split(text: string): { before: string; core: string; after: string } {
  const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(text)!;
  return { before: m[1], core: m[2], after: m[3] };
}

const keyOf = (text: string) => split(text.normalize("NFKC")).core.toLowerCase().replace(/\s+/g, " ");

const letters = (s: string) => s.replace(/[^\p{L}]/gu, "");
const isUpper = (s: string) => letters(s).length > 1 && s === s.toUpperCase() && s !== s.toLowerCase();
const startsUpper = (s: string) => /^\p{Lu}/u.test(s);
const first = (s: string, upper: boolean) => (upper ? s.charAt(0).toUpperCase() : s.charAt(0).toLowerCase()) + s.slice(1);

/** `translated` (of `known`) written the way `wanted` is. */
function inCaseOf(wanted: string, known: string, translated: string): string {
  if (isUpper(wanted)) return isUpper(known) ? translated : translated.toUpperCase();
  const base = isUpper(known) && isUpper(translated) ? translated.toLowerCase() : translated;
  if (isUpper(known) || startsUpper(wanted) !== startsUpper(known)) return first(base, startsUpper(wanted));
  return base;
}

export interface Suggestion {
  /** The translation, or null = "doesn't translate". */
  text: string | null;
  /** The text it was decided for (the same one, or a nearly identical one), and where. */
  from: string;
  place: string;
}

interface Decision {
  place: string;
  text: string;
  entry: TextEntry;
}

const indexes = new WeakMap<Translation, Map<string, Decision[]>>();

/** Everything decided in a language, by the words of the text. The shortest spelling first: it is the plainest. */
function indexOf(t: Translation): Map<string, Decision[]> {
  let index = indexes.get(t);
  if (!index) {
    index = new Map();
    const all = Object.entries(t.texts).flatMap(([place, here]) => Object.entries(here).map(([text, entry]) => ({ place, text, entry })));
    for (const d of all.sort((a, b) => a.text.length - b.text.length)) {
      const key = keyOf(d.text);
      if (key && (d.entry.to?.trim() || d.entry.same)) index.set(key, [...(index.get(key) ?? []), d]);
    }
    indexes.set(t, index);
  }
  return index;
}

/** `decided`'s translation, adapted to how `text` is written. */
function adapt(text: string, { text: from, entry }: Decision): string | null {
  const translated = entry.to?.trim();
  if (!translated) return null;
  if (from === text) return translated;
  const wanted = split(text);
  const known = split(from);
  const own = split(translated);
  // Only the case differs: keep the translation's own punctuation ("¿Qué?").
  if (wanted.before === known.before && wanted.after === known.after) return own.before + inCaseOf(wanted.core, known.core, own.core) + own.after;
  return wanted.before + inCaseOf(wanted.core, known.core, own.core || translated) + wanted.after;
}

/**
 * What was decided for the same text in other places (it may mean something else here, so it is
 * the owner's call), or, when there is none, for a nearly identical one. Different translations
 * of the same text are all offered.
 */
export function suggestTranslations(t: Translation, place: string, text: string, max = 3): Suggestion[] {
  const known = indexOf(t).get(keyOf(text)) ?? [];
  const identical = known.filter((d) => d.text === text && d.place !== place);
  // A nearly identical text that stays as it is says little; a translation does.
  const near = known.filter((d) => d.text !== text && d.entry.to?.trim()).slice(0, 1);
  const out: Suggestion[] = [];
  for (const d of identical.length ? identical : near) {
    const suggestion = { text: adapt(text, d), from: d.text, place: d.place };
    if (!out.some((o) => o.text === suggestion.text)) out.push(suggestion);
  }
  return out.slice(0, max);
}
