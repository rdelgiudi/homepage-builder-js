"use client";

import { useRef, useState, type ReactNode } from "react";
import { uploadFile } from "./api";
import { markdownEdit, type ActionOptions, type MarkdownAction } from "./markdown-edit";

interface Tool {
  action: MarkdownAction;
  label: string;
  /** What the button shows. */
  face: ReactNode;
  keys?: string;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

/** Toolbar groups, separated by a divider. */
const GROUPS: Tool[][] = [
  [
    { action: "h1", label: "Heading 1", face: "H1" },
    { action: "h2", label: "Heading 2", face: "H2" },
    { action: "h3", label: "Heading 3", face: "H3" },
  ],
  [
    { action: "bold", label: "Bold", face: <b>B</b>, keys: `${mod}B` },
    { action: "italic", label: "Italic", face: <i>I</i>, keys: `${mod}I` },
    { action: "strike", label: "Strikethrough", face: <s>S</s> },
    { action: "code", label: "Inline code", face: <code>{"</>"}</code> },
  ],
  [
    { action: "link", label: "Link", face: "Link", keys: `${mod}K` },
    { action: "image", label: "Image from an address", face: "Image" },
  ],
  [
    { action: "bullet", label: "Bulleted list", face: "• List" },
    { action: "numbered", label: "Numbered list", face: "1. List" },
    { action: "task", label: "Checklist", face: "☑ Tasks" },
    { action: "quote", label: "Quote", face: "❝ Quote" },
  ],
  [
    { action: "codeblock", label: "Code block", face: "{ } Code" },
    { action: "table", label: "Table", face: "Table" },
    { action: "hr", label: "Divider line", face: "―" },
  ],
];

const SHORTCUTS: Record<string, MarkdownAction> = { b: "bold", i: "italic", k: "link" };

/**
 * The Content screen's markdown textarea with a formatting toolbar. Every action is one
 * replacement (markdown-edit.ts) inserted with the browser's own text insertion, so the
 * textarea's undo (Ctrl+Z) keeps working.
 */
export default function MarkdownEditor({
  value,
  onChange,
  label,
  fileName,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** For the post details' starting title. */
  fileName: string;
  onSave: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (action: MarkdownAction, options: ActionOptions = {}) => {
    const ta = area.current;
    if (!ta) return;
    ta.focus();
    const edit = markdownEdit(action, { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd }, options);
    if (!edit) return;
    if (ta.value.slice(edit.start, edit.end) !== edit.text) {
      ta.setSelectionRange(edit.start, edit.end);
      // insertText keeps the textarea's own undo history and fires `input` (→ onChange).
      const done = edit.text ? document.execCommand("insertText", false, edit.text) : document.execCommand("delete");
      if (!done) {
        ta.setRangeText(edit.text, edit.start, edit.end);
        onChange(ta.value);
      }
    }
    ta.setSelectionRange(edit.select[0], edit.select[1]);
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      apply("image", { url, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="adm-md">
      <div className="adm-md-tools" role="toolbar" aria-label="Formatting">
        {GROUPS.map((group, i) => (
          <div key={i} className="adm-md-group">
            {group.map((t) => (
              <button
                key={t.action}
                type="button"
                className="adm-md-tool"
                title={t.keys ? `${t.label} (${t.keys})` : t.label}
                aria-label={t.label}
                // Keep the textarea's selection: a button would otherwise take the focus first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => apply(t.action)}
              >
                {t.face}
              </button>
            ))}
          </div>
        ))}
        <div className="adm-md-group">
          <button type="button" className="adm-md-tool" title="Upload an image and insert it" disabled={uploading} onMouseDown={(e) => e.preventDefault()} onClick={() => picker.current?.click()}>
            {uploading ? "Uploading…" : "⤒ Upload image"}
          </button>
          <button
            type="button"
            className="adm-md-tool"
            title="Title, date, summary and tags at the top of the file. A file with a date is a blog post."
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              apply("frontmatter", {
                today: new Date().toLocaleDateString("sv"), // YYYY-MM-DD in the local time zone
                title: (fileName.split("/").pop() ?? "").replace(/\.md$/, "").replace(/[-_]+/g, " "),
              })
            }
          >
            Post details
          </button>
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>
      {error && <p className="adm-notice is-bad adm-md-error">{error}</p>}
      <textarea
        ref={area}
        className="adm-input adm-code"
        aria-label={label}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
          const key = e.key.toLowerCase();
          if (key === "s") {
            e.preventDefault();
            onSave();
          } else if (SHORTCUTS[key] && !e.shiftKey) {
            e.preventDefault();
            apply(SHORTCUTS[key]);
          }
        }}
        // Pasting or dropping an image file uploads it and inserts it.
        onPaste={(e) => {
          const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
          if (file) {
            e.preventDefault();
            upload(file);
          }
        }}
        onDrop={(e) => {
          const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
          if (file) {
            e.preventDefault();
            upload(file);
          }
        }}
      />
    </div>
  );
}
