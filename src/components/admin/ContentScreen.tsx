"use client";

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "./api";
import { forgetContentFiles } from "./SchemaForm";

interface FileInfo {
  name: string;
  bytes: number;
  modifiedAt: number;
}

export default function ContentScreen() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [writable, setWritable] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [html, setHtml] = useState("");
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const loadList = useCallback(async () => {
    const data = await api<{ files: FileInfo[]; writable: boolean }>("content");
    setFiles(data.files);
    setWritable(data.writable);
    forgetContentFiles();
    return data.files;
  }, []);

  const open = useCallback(async (file: string) => {
    try {
      const data = await api<{ content: string }>(`content?file=${encodeURIComponent(file)}`);
      setName(file);
      setText(data.content);
      setSavedText(data.content);
      setMessage(null);
    } catch (err) {
      setMessage({ text: (err as Error).message, bad: true });
    }
  }, []);

  useEffect(() => {
    loadList()
      .then((list) => list[0] && open(list[0].name))
      .catch((err) => setMessage({ text: (err as Error).message, bad: true }));
  }, [loadList, open]);

  // Rendered preview, debounced.
  useEffect(() => {
    if (name === null) return;
    const timer = setTimeout(() => {
      api<{ html: string }>("content", { method: "POST", body: { markdown: text } })
        .then((d) => setHtml(d.html))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [text, name]);

  const dirty = text !== savedText;
  const leaveOk = () => !dirty || window.confirm("Discard unsaved changes to this file?");

  const save = async () => {
    if (!name) return;
    try {
      await api("content", { method: "PUT", body: { file: name, content: text } });
      setSavedText(text);
      setMessage({ text: "Saved. Visitors see it within 5 minutes (pages cache markdown)." });
      loadList();
    } catch (err) {
      setMessage({ text: (err as Error).message, bad: true });
    }
  };

  const create = async () => {
    const file = newName.trim().endsWith(".md") ? newName.trim() : `${newName.trim()}.md`;
    if (!leaveOk()) return;
    try {
      await api("content", { method: "PUT", body: { file, content: `# ${file.replace(/\.md$/, "")}\n` } });
      setNewName("");
      await loadList();
      await open(file);
    } catch (err) {
      setMessage({ text: (err as Error).message, bad: true });
    }
  };

  const remove = async () => {
    if (!name || !window.confirm(`Delete ${name}? Markdown widgets that use it will show "File not found".`)) return;
    try {
      await api(`content?file=${encodeURIComponent(name)}`, { method: "DELETE" });
      setName(null);
      setText("");
      setSavedText("");
      setHtml("");
      const list = await loadList();
      if (list[0]) open(list[0].name);
    } catch (err) {
      setMessage({ text: (err as Error).message, bad: true });
    }
  };

  return (
    <div className="adm-content">
      <aside className="adm-panel">
        <div className="adm-panel-head">
          <h2>Markdown files</h2>
        </div>
        <ul className="adm-rows">
          {files.map((f) => (
            <li key={f.name} className={`adm-row is-static${f.name === name ? " is-selected" : ""}`}>
              <button type="button" className="adm-row-button" onClick={() => leaveOk() && open(f.name)}>
                <span className="adm-row-text">
                  <span className="adm-row-title">{f.name}</span>
                  <span className="adm-row-sub">edited {timeAgo(f.modifiedAt)}</span>
                </span>
              </button>
            </li>
          ))}
          {!files.length && <li className="adm-empty">No markdown files yet. Create one below.</li>}
        </ul>
        <form
          className="adm-pad adm-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create();
          }}
        >
          <input className="adm-input" aria-label="New file name" placeholder="new-page.md" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="adm-btn is-small" disabled={!newName.trim()}>
            Create
          </button>
        </form>
        <p className="adm-hint adm-pad">Show a file on the site by adding a Markdown widget in the builder. Files are saved straight to the site — they are not part of the draft.</p>
        {!writable && <p className="adm-notice is-warn adm-pad">The content folder is read-only, so files can&apos;t be saved. In Docker, mount src/content without :ro.</p>}
      </aside>

      {name === null ? (
        <div className="adm-center adm-muted">Choose a file to edit.</div>
      ) : (
        <section className="adm-editor">
          <div className="adm-editor-bar">
            <strong>{name}</strong>
            {message && <span className={message.bad ? "adm-bad" : "adm-muted"}>{message.text}</span>}
            <span className="adm-spacer" />
            <button type="button" className="adm-btn is-danger" onClick={remove}>
              Delete file
            </button>
            <button type="button" className="adm-btn is-primary" disabled={!dirty} onClick={save}>
              {dirty ? "Save file" : "Saved"}
            </button>
          </div>
          <div className="adm-editor-panes">
            <textarea className="adm-input adm-code" aria-label={`Contents of ${name}`} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
            <div className="adm-markdown prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </section>
      )}
    </div>
  );
}
