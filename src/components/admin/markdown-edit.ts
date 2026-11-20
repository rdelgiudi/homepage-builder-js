/**
 * The markdown editor's toolbar actions (pure, unit-tested). Each one turns the text and the
 * selection into a single replacement (`start`..`end` → `text`) plus the selection to show
 * afterwards. The editor applies it with the browser's own text insertion, so the textarea's
 * native undo (Ctrl+Z) keeps working.
 */

export interface Selection {
  value: string;
  start: number;
  end: number;
}

export interface TextEdit {
  start: number;
  end: number;
  text: string;
  /** Selection after the edit. */
  select: [number, number];
}

export type MarkdownAction =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "bullet"
  | "numbered"
  | "task"
  | "link"
  | "image"
  | "codeblock"
  | "table"
  | "hr"
  | "frontmatter";

export interface ActionOptions {
  /** image: the address to insert (an upload), else a placeholder is selected. */
  url?: string;
  /** image: alt text. */
  alt?: string;
  /** frontmatter: today's date (YYYY-MM-DD) and a title to start from. */
  today?: string;
  title?: string;
}

// --- inline: wrap the selection in markers (again = unwrap) ---

const WRAPS = {
  bold: ["**", "bold text"],
  italic: ["_", "italic text"],
  strike: ["~~", "struck text"],
  code: ["`", "code"],
} as const;

function wrap({ value, start, end }: Selection, marker: string, placeholder: string): TextEdit {
  const m = marker.length;
  const inner = value.slice(start, end);
  // Already wrapped, markers just outside the selection: unwrap.
  if (start >= m && value.slice(start - m, start) === marker && value.slice(end, end + m) === marker) {
    return { start: start - m, end: end + m, text: inner, select: [start - m, end - m] };
  }
  // The selection includes the markers: unwrap.
  if (inner.length > 2 * m && inner.startsWith(marker) && inner.endsWith(marker)) {
    return { start, end, text: inner.slice(m, -m), select: [start, end - 2 * m] };
  }
  // Spaces stay outside the markers: "**word **" is not bold in markdown.
  const lead = inner.match(/^\s*/)![0];
  const trail = inner.slice(lead.length).match(/\s*$/)![0];
  const core = inner.slice(lead.length, inner.length - trail.length) || placeholder;
  const at = start + lead.length + m;
  return { start, end, text: `${lead}${marker}${core}${marker}${trail}`, select: [at, at + core.length] };
}

// --- line prefixes: headings, quote, lists (again = remove) ---

/** The full lines the selection touches. */
function lineRange({ value, start, end }: Selection): [number, number] {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  // A selection ending right after a newline doesn't include the next line.
  const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nl = value.indexOf("\n", last);
  return [from, nl === -1 ? value.length : nl];
}

const LIST_MARKER = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/;
const HEADING = /^#{1,6}\s+/;

function prefixLines(sel: Selection, kind: "h1" | "h2" | "h3" | "quote" | "bullet" | "numbered" | "task"): TextEdit {
  const [from, to] = lineRange(sel);
  const lines = sel.value.slice(from, to).split("\n");
  const content = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.trim() || lines.length === 1);

  const has = (l: string): boolean => {
    if (kind.startsWith("h")) return new RegExp(`^#{${kind[1]}}\\s`).test(l);
    if (kind === "quote") return /^>\s?/.test(l);
    if (kind === "task") return /^\s*[-*+]\s+\[[ xX]\]\s/.test(l);
    if (kind === "bullet") return /^\s*[-*+]\s/.test(l) && !/^\s*[-*+]\s+\[[ xX]\]\s/.test(l);
    return /^\s*\d+[.)]\s/.test(l);
  };
  const remove = content.length > 0 && content.every(({ l }) => has(l));

  let n = 0;
  const out = lines.map((l, i) => {
    if (!content.some((c) => c.i === i)) return l;
    if (kind.startsWith("h")) {
      const bare = l.replace(HEADING, "");
      return remove ? bare : `${"#".repeat(Number(kind[1]))} ${bare}`;
    }
    if (kind === "quote") return remove ? l.replace(/^>\s?/, "") : `> ${l}`;
    // Lists: switching between list kinds replaces the marker; indentation is kept.
    const indent = l.match(/^\s*/)![0];
    const bare = l.replace(LIST_MARKER, "$1").slice(indent.length);
    if (remove) return indent + bare;
    n++;
    return `${indent}${kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${n}. `}${bare}`;
  });
  const text = out.join("\n");
  // One line with a plain caret: keep the caret on the same text. Otherwise select the lines.
  if (lines.length === 1 && sel.start === sel.end) {
    const caret = Math.max(from, Math.min(from + text.length, sel.start + (text.length - (to - from))));
    return { start: from, end: to, text, select: [caret, caret] };
  }
  return { start: from, end: to, text, select: [from, from + text.length] };
}

// --- blocks: on their own lines, with a blank line around them ---

function block({ value, start, end }: Selection, body: string, pick: [number, number]): TextEdit {
  const before = start === 0 ? "" : value[start - 1] !== "\n" ? "\n\n" : start > 1 && value[start - 2] !== "\n" ? "\n" : "";
  const after = end >= value.length ? "\n" : value[end] !== "\n" ? "\n\n" : value[end + 1] !== undefined && value[end + 1] !== "\n" ? "\n" : "";
  const at = start + before.length;
  return { start, end, text: before + body + after, select: [at + pick[0], at + pick[1]] };
}

const isUrl = (s: string) => /^(https?:\/\/|\/|mailto:)\S+$/.test(s.trim());

/** The edit for one toolbar action, or null when there is nothing to do. */
export function markdownEdit(action: MarkdownAction, sel: Selection, options: ActionOptions = {}): TextEdit | null {
  const selected = sel.value.slice(sel.start, sel.end);
  switch (action) {
    case "bold":
    case "italic":
    case "strike":
    case "code":
      return wrap(sel, WRAPS[action][0], WRAPS[action][1]);
    case "h1":
    case "h2":
    case "h3":
    case "quote":
    case "bullet":
    case "numbered":
    case "task":
      return prefixLines(sel, action);
    case "link": {
      // A selected address becomes the target; selected words become the link text.
      if (selected && isUrl(selected)) {
        const text = `[link text](${selected.trim()})`;
        return { start: sel.start, end: sel.end, text, select: [sel.start + 1, sel.start + 10] };
      }
      const label = selected || "link text";
      const text = `[${label}](https://)`;
      const urlAt = sel.start + label.length + 3;
      // With text selected the address is what's left to type; otherwise the label.
      return { start: sel.start, end: sel.end, text, select: selected ? [urlAt, urlAt + 8] : [sel.start + 1, sel.start + 1 + label.length] };
    }
    case "image": {
      const alt = (options.alt ?? selected ?? "").replace(/[[\]\n]/g, " ").trim() || "description";
      const url = options.url ?? "https://";
      const text = `![${alt}](${url})`;
      // With an address given, select the alt text (describe the image); otherwise the address.
      const urlAt = sel.start + alt.length + 4;
      return { start: sel.start, end: sel.end, text, select: options.url ? [sel.start + 2, sel.start + 2 + alt.length] : [urlAt, urlAt + url.length] };
    }
    case "codeblock": {
      const code = selected.replace(/\n$/, "") || "code";
      return block(sel, "```\n" + code + "\n```", [4, 4 + code.length]);
    }
    case "table":
      return block(sel, "| Column | Column |\n| --- | --- |\n| Cell | Cell |", [2, 8]);
    case "hr":
      return block({ ...sel, start: sel.end }, "---", [3, 3]);
    case "frontmatter": {
      // Post details go at the very top. Already there: just select them.
      const existing = sel.value.match(/^---\n[\s\S]*?\n---\n?/);
      if (existing) return { start: 0, end: existing[0].length, text: existing[0], select: [4, existing[0].lastIndexOf("\n---")] };
      const title = (options.title ?? "").replace(/"/g, "'") || "Post title";
      const head = `---\ntitle: "${title}"\ndate: ${options.today ?? "2026-01-01"}\nsummary: ""\ntags: []\n---\n\n`;
      return { start: 0, end: 0, text: head, select: [12, 12 + title.length] };
    }
  }
}
