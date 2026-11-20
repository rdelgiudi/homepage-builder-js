/**
 * When typing becomes an undo step (pure, unit-tested; used by store.tsx).
 *
 * Every edit made while typing into one field joins that field's current step. The step ends
 * when the typing pauses (TYPING_IDLE_MS), when focus leaves the field, or, in bigger text
 * fields, every few words (at the space after a word), so undoing a long paragraph doesn't
 * throw all of it away at once.
 */

/** A pause this long ends the step. */
export const TYPING_IDLE_MS = 1500;
/** Bigger text fields: a step holds about this many words. */
export const WORDS_PER_STEP = 4;
/** A single-line field counts as "bigger" from this many characters. */
export const LONG_TEXT_CHARS = 60;

/** Inputs whose edits aren't typing: one click = one step, as before. */
const NOT_TYPING = new Set(["checkbox", "radio", "file", "button", "submit", "reset", "image", "hidden"]);

/**
 * Fields whose edits are merged: textareas and text-like inputs. That includes number, color
 * and range inputs, which also fire an edit per arrow key / drag movement.
 */
export function isTypingField(el: { tagName?: string; type?: string } | null | undefined): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !NOT_TYPING.has((el.type || "text").toLowerCase());
}

export const countWords = (text: string) => (text.match(/\S+/g) ?? []).length;

/**
 * Words in the field when a step starts, not counting the word the caret is in: a step's first
 * keystroke is usually the first letter of a word that belongs to the step.
 */
export const wordsAtStart = (value: string, caret: number) => countWords(value.slice(0, caret).replace(/\S+$/, "")) + countWords(value.slice(caret).replace(/^\S+/, ""));

/** Fields that get a step every few words. */
export const isLongText = (tagName: string, value: string) => tagName === "TEXTAREA" || value.length > LONG_TEXT_CHARS;

/**
 * After this edit, does the step end? Only in bigger fields, once the word count has moved by
 * WORDS_PER_STEP since the step began, and only right after a space (or other whitespace), so a
 * step never ends in the middle of a word. `caret` = the caret position after the edit.
 */
export function endsStep(startWords: number, value: string, caret: number, long: boolean): boolean {
  if (!long || caret <= 0) return false;
  return /\s/.test(value[caret - 1] ?? "") && Math.abs(countWords(value) - startWords) >= WORDS_PER_STEP;
}
