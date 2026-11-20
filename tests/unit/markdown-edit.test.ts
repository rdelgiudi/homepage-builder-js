import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownEdit, type MarkdownAction, type ActionOptions } from "@/components/admin/markdown-edit";

/** Applies an action to text with the selection marked by [ and ] (or a single | caret); returns the result in the same notation. */
function run(action: MarkdownAction, marked: string, options?: ActionOptions): string {
  const caret = marked.indexOf("|");
  const start = caret >= 0 ? caret : marked.indexOf("[");
  const value = caret >= 0 ? marked.replace("|", "") : marked.replace("[", "").replace("]", "");
  const end = caret >= 0 ? caret : marked.indexOf("]") - 1;
  const edit = markdownEdit(action, { value, start, end }, options);
  assert.ok(edit);
  const out = value.slice(0, edit.start) + edit.text + value.slice(edit.end);
  const [a, b] = edit.select;
  return a === b ? out.slice(0, a) + "|" + out.slice(a) : out.slice(0, a) + "[" + out.slice(a, b) + "]" + out.slice(b);
}

describe("markdown toolbar: inline styles", () => {
  it("wraps the selection and toggles back off", () => {
    assert.equal(run("bold", "say [hello] now"), "say **[hello]** now");
    assert.equal(run("bold", "say **[hello]** now"), "say [hello] now");
    assert.equal(run("bold", "say [**hello**] now"), "say [hello] now");
    assert.equal(run("italic", "[word]"), "_[word]_");
    assert.equal(run("strike", "[old]"), "~~[old]~~");
    assert.equal(run("code", "run [npm test]"), "run `[npm test]`");
  });
  it("inserts a selected placeholder at a plain caret", () => {
    assert.equal(run("bold", "a |b"), "a **[bold text]**b");
  });
  it("keeps spaces outside the markers", () => {
    assert.equal(run("bold", "x[ word ]y"), "x **[word]** y");
  });
});

describe("markdown toolbar: lines", () => {
  it("headings set, change and remove the level", () => {
    assert.equal(run("h2", "Ti|tle"), "## Ti|tle");
    assert.equal(run("h1", "## Ti|tle"), "# Ti|tle");
    assert.equal(run("h2", "## Ti|tle"), "Ti|tle");
  });
  it("lists prefix every line, number them, switch kinds and toggle off", () => {
    assert.equal(run("bullet", "[one\ntwo]"), "[- one\n- two]");
    assert.equal(run("numbered", "[one\n\ntwo]"), "[1. one\n\n2. two]");
    assert.equal(run("task", "[- one\n- two]"), "[- [ ] one\n- [ ] two]");
    assert.equal(run("bullet", "[- one\n- two]"), "[one\ntwo]");
    assert.equal(run("bullet", "  in|dented"), "  - in|dented");
  });
  it("only touches the lines the selection covers", () => {
    assert.equal(run("quote", "a\n[b\n]c"), "a\n[> b]\nc");
  });
});

describe("markdown toolbar: links, images and blocks", () => {
  it("links: words become the text, an address becomes the target", () => {
    assert.equal(run("link", "see [the docs] here"), "see [the docs]([https://]) here");
    assert.equal(run("link", "see [https://x.dev] here"), "see [[link text]](https://x.dev) here");
    assert.equal(run("link", "|"), "[[link text]](https://)");
  });
  it("images: an uploaded address selects the alt text to describe it", () => {
    assert.equal(run("image", "|", { url: "/api/uploads/abc.webp", alt: "cat" }), "![[cat]](/api/uploads/abc.webp)");
    assert.equal(run("image", "|"), "![description]([https://])");
  });
  it("blocks get their own lines with a blank line around them", () => {
    assert.equal(run("codeblock", "text|"), "text\n\n```\n[code]\n```\n");
    assert.equal(run("codeblock", "[a = 1]"), "```\n[a = 1]\n```\n");
    assert.equal(run("table", "|"), "| [Column] | Column |\n| --- | --- |\n| Cell | Cell |\n");
    assert.equal(run("hr", "one|\ntwo"), "one\n\n---|\n\ntwo");
  });
  it("post details go on top once", () => {
    assert.equal(run("frontmatter", "Body|", { today: "2026-11-20", title: "Hello" }), '---\ntitle: "[Hello]"\ndate: 2026-11-20\nsummary: ""\ntags: []\n---\n\nBody');
    const again = run("frontmatter", '---\ntitle: "x"\n---\nBody|');
    assert.ok(again.startsWith('---\n[title: "x"]\n---\n'), again);
  });
});
