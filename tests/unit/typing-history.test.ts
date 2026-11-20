import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS_PER_STEP, countWords, endsStep, isLongText, isTypingField, wordsAtStart } from "@/components/admin/typing-history";

test("isTypingField: text-like inputs and textareas merge; toggles, files and buttons don't", () => {
  assert.equal(isTypingField({ tagName: "TEXTAREA" }), true);
  for (const type of ["text", "", "url", "number", "color", "range", "date", "search"]) assert.equal(isTypingField({ tagName: "INPUT", type }), true, type);
  for (const type of ["checkbox", "radio", "file", "button"]) assert.equal(isTypingField({ tagName: "INPUT", type }), false, type);
  assert.equal(isTypingField({ tagName: "SELECT" }), false);
  assert.equal(isTypingField({ tagName: "BUTTON" }), false);
  assert.equal(isTypingField(null), false);
});

test("countWords / isLongText", () => {
  assert.equal(countWords("  one two\nthree  "), 3);
  assert.equal(countWords(""), 0);
  assert.equal(isLongText("TEXTAREA", ""), true);
  assert.equal(isLongText("INPUT", "short title"), false);
  assert.equal(isLongText("INPUT", "x".repeat(61)), true);
});

test("wordsAtStart leaves out the word being typed", () => {
  assert.equal(wordsAtStart("one two three four f", 20), 4);
  assert.equal(wordsAtStart("one two ", 8), 2);
  assert.equal(wordsAtStart("one twXo three", 6), 2); // caret inside "twXo"
});

test("endsStep: bigger fields end a step every few words, only right after a space", () => {
  const four = "one two three four ";
  assert.equal(WORDS_PER_STEP, 4);
  assert.equal(endsStep(0, four, four.length, true), true);
  // Mid-word: wait for the space.
  assert.equal(endsStep(0, "one two three fou", 17, true), false);
  // Not enough words since the step began.
  assert.equal(endsStep(2, four, four.length, true), false);
  // Short single-line fields only end on a pause or leaving the field.
  assert.equal(endsStep(0, four, four.length, false), false);
  // Deleting words counts too.
  assert.equal(endsStep(9, "a b c d e ", 10, true), true);
  // Caret in the middle: the character before it decides.
  assert.equal(endsStep(0, "one two three four five", 19, true), true);
  assert.equal(endsStep(0, "one two three four five", 0, true), false);
});
