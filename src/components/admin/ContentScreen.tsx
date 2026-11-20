"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, timeAgo } from "./api";
import { forgetContentFiles } from "./SchemaForm";
import { forgetFileLinks } from "./useSiteMap";
import { useAdmin } from "./store";
import { allSections, mapSections } from "@/lib/pages";
import MarkdownEditor from "./MarkdownEditor";
import { baseName, contentTree, dropTarget, joinPath, parentOf, type TreeFile, type TreeFolder } from "./content-tree";

/** Markdown widgets (in a config) that show one of `names`. */
const usersOf = (config: HomepageConfig, names: Set<string>) =>
  allSections(config).filter((s) => s.type === "markdown" && names.has((s as { file?: string }).file ?? "")).length;

/** Drag-and-drop payload type for moving files and folders in the tree. */
const DRAG_TYPE = "application/x-homepage-content";

export default function ContentScreen() {
  const { config, published, update } = useAdmin();
  const [files, setFiles] = useState<TreeFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [writable, setWritable] = useState(true);
  const [name, setName] = useState<string | null>(null);
  /** Where "New file" / "New folder" create things ("" = the content folder itself). */
  const [folder, setFolder] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [html, setHtml] = useState("");
  const [newName, setNewName] = useState("");
  /** Rename / move: the item being renamed and the path typed so far. */
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);

  const tree = useMemo(() => contentTree(files, folders), [files, folders]);
  const inUse = useMemo(() => new Set(allSections(config).flatMap((s) => (s.type === "markdown" ? [(s as { file?: string }).file ?? ""] : []))), [config]);

  const loadList = useCallback(async () => {
    const data = await api<{ files: TreeFile[]; folders: string[]; writable: boolean }>("content");
    setFiles(data.files);
    setFolders(data.folders);
    setWritable(data.writable);
    forgetContentFiles();
    // Links inside files count for the site map (pages reachable from the homepage).
    forgetFileLinks();
    return data.files;
  }, []);

  const open = useCallback(async (file: string) => {
    try {
      const data = await api<{ content: string }>(`content?file=${encodeURIComponent(file)}`);
      setName(file);
      setFolder(parentOf(file));
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
  const fail = (err: unknown) => setMessage({ text: (err as Error).message, bad: true });

  const save = async () => {
    if (!name || !dirty) return;
    try {
      await api("content", { method: "PUT", body: { file: name, content: text } });
      setSavedText(text);
      setMessage({ text: "Saved. Visitors see it within 5 minutes (pages cache markdown)." });
      loadList();
    } catch (err) {
      fail(err);
    }
  };

  const createFile = async () => {
    const typed = newName.trim().replace(/^\/+/, "");
    const file = joinPath(folder, typed.endsWith(".md") ? typed : `${typed}.md`);
    if (!leaveOk()) return;
    try {
      await api("content", { method: "PUT", body: { file, content: `# ${baseName(file).replace(/\.md$/, "")}\n` } });
      setNewName("");
      await loadList();
      await open(file);
    } catch (err) {
      fail(err);
    }
  };

  const createFolder = async () => {
    const path = joinPath(folder, newName.trim().replace(/^\/+|\/+$/g, ""));
    try {
      await api("content", { method: "PUT", body: { folder: path } });
      setNewName("");
      setFolder(path);
      await loadList();
      setMessage({ text: `Folder ${path} created. New files go into it.` });
    } catch (err) {
      fail(err);
    }
  };

  /**
   * Renames or moves a file or folder. Markdown widgets in the draft that show a moved file are
   * pointed at its new name (one undo step); the live site keeps the old names until Publish.
   */
  const move = async (from: string, to: string) => {
    if (from === to) return setRenaming(null);
    const isFile = from.endsWith(".md");
    if (isFile && from === name && !leaveOk()) return;
    try {
      const res = await api<{ moved: { from: string; to: string }[] }>("content", { method: "PATCH", body: { from, to } });
      setRenaming(null);
      const map = new Map(res.moved.map((m) => [m.from, m.to]));
      const used = usersOf(config, new Set(map.keys()));
      const live = usersOf(published, new Set(map.keys()));
      if (used) {
        update((c) =>
          mapSections(c, (s) => {
            const file = s.type === "markdown" ? (s as { file?: string }).file : undefined;
            return file && map.has(file) ? ({ ...s, file: map.get(file) } as typeof s) : s;
          })
        );
      }
      await loadList();
      if (name && map.has(name)) {
        setName(map.get(name)!);
        if (!isFile) setFolder(parentOf(map.get(name)!));
      }
      if (!isFile && (folder === from || folder.startsWith(`${from}/`))) setFolder(to + folder.slice(from.length));
      if (isFile && name === from) setFolder(parentOf(to));
      setMessage({
        text:
          `Moved to ${to}.` +
          (used ? ` ${used} Markdown widget${used === 1 ? "" : "s"} in your draft now use${used === 1 ? "s" : ""} the new name.` : "") +
          (live ? ` The live site shows "File not found" there until you publish.` : ""),
        bad: live > 0,
      });
    } catch (err) {
      fail(err);
    }
  };

  const removeFile = async () => {
    if (!name) return;
    const used = usersOf(config, new Set([name]));
    if (!window.confirm(`Delete ${name}?${used ? ` ${used} Markdown widget${used === 1 ? " uses" : "s use"} it and will show "File not found".` : ""}`)) return;
    try {
      await api(`content?file=${encodeURIComponent(name)}`, { method: "DELETE" });
      setName(null);
      setText("");
      setSavedText("");
      setHtml("");
      const list = await loadList();
      if (list[0]) open(list[0].name);
    } catch (err) {
      fail(err);
    }
  };

  const removeFolder = async (path: string) => {
    const inside = files.filter((f) => f.name.startsWith(`${path}/`));
    const used = usersOf(config, new Set(inside.map((f) => f.name)));
    const what = inside.length ? ` and the ${inside.length} file${inside.length === 1 ? "" : "s"} in it` : "";
    if (!window.confirm(`Delete the folder ${path}${what}?${used ? ` ${used} Markdown widget${used === 1 ? " uses" : "s use"} them and will show "File not found".` : ""}`)) return;
    if (name?.startsWith(`${path}/`) && dirty && !window.confirm("The open file has unsaved changes. Delete anyway?")) return;
    try {
      await api(`content?folder=${encodeURIComponent(path)}`, { method: "DELETE" });
      setFolder(parentOf(path));
      const list = await loadList();
      if (name?.startsWith(`${path}/`)) {
        setName(null);
        setText("");
        setSavedText("");
        if (list[0]) open(list[0].name);
      }
    } catch (err) {
      fail(err);
    }
  };

  // --- drag a file or folder onto a folder (or the top of the list) to move it there ---
  const dragProps = (item: string) => ({
    draggable: writable,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, item);
      e.dataTransfer.effectAllowed = "move";
    },
  });
  const dropProps = (target: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropOn(target);
    },
    onDragLeave: () => setDropOn((d) => (d === target ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropOn(null);
      const item = e.dataTransfer.getData(DRAG_TYPE);
      const to = item ? dropTarget(item, target) : null;
      if (to) move(item, to);
    },
  });

  const renameField = (from: string) =>
    renaming?.from === from && (
      <form
        className="adm-inline adm-rename"
        onSubmit={(e) => {
          e.preventDefault();
          move(renaming.from, renaming.to.trim());
        }}
      >
        <input
          className="adm-input"
          aria-label={`New name or path for ${from}`}
          autoFocus
          value={renaming.to}
          onChange={(e) => setRenaming({ from, to: e.target.value })}
          onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
        />
        <button type="submit" className="adm-btn is-small">
          Move
        </button>
        <button type="button" className="adm-btn is-small is-ghost" onClick={() => setRenaming(null)}>
          Cancel
        </button>
      </form>
    );

  const renderFolder = (node: TreeFolder, depth: number): React.ReactNode => (
    <>
      {node.folders.map((sub) => {
        const open = !collapsed.has(sub.path);
        return (
          <li key={sub.path} className="adm-tree-item">
            <div
              className={`adm-row is-static adm-tree-folder${folder === sub.path ? " is-selected" : ""}${dropOn === sub.path ? " is-drop" : ""}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              {...dragProps(sub.path)}
              {...dropProps(sub.path)}
            >
              <button
                type="button"
                className="adm-tree-caret"
                aria-expanded={open}
                aria-label={`${open ? "Collapse" : "Expand"} ${sub.path}`}
                onClick={() =>
                  setCollapsed((c) => {
                    const next = new Set(c);
                    if (open) next.add(sub.path);
                    else next.delete(sub.path);
                    return next;
                  })
                }
              >
                {open ? "▾" : "▸"}
              </button>
              <button type="button" className="adm-row-button" title="New files go into the selected folder" onClick={() => setFolder(sub.path)}>
                <span className="adm-row-icon" aria-hidden>
                  📁
                </span>
                <span className="adm-row-text">
                  <span className="adm-row-title">{sub.label}</span>
                </span>
                <span className="adm-count">{sub.count}</span>
              </button>
            </div>
            {renameField(sub.path)}
            {open && (
              <ul className="adm-tree">
                {renderFolder(sub, depth + 1)}
                {!sub.folders.length && !sub.files.length && (
                  <li className="adm-tree-empty" style={{ paddingLeft: 6 + (depth + 1) * 14 + 18 }}>
                    Empty folder
                  </li>
                )}
              </ul>
            )}
          </li>
        );
      })}
      {node.files.map((f) => (
        <li key={f.name} className="adm-tree-item">
          <div className={`adm-row is-static${f.name === name ? " is-selected" : ""}`} style={{ paddingLeft: 6 + depth * 14 + 18 }} {...dragProps(f.name)}>
            <button type="button" className="adm-row-button" onClick={() => f.name !== name && leaveOk() && open(f.name)}>
              <span className="adm-row-text">
                <span className="adm-row-title">{baseName(f.name)}</span>
                <span className="adm-row-sub">edited {timeAgo(f.modifiedAt)}</span>
              </span>
              {inUse.has(f.name) && (
                <span className="adm-badge" title="Shown by a Markdown widget in your draft">
                  in use
                </span>
              )}
            </button>
          </div>
        </li>
      ))}
    </>
  );

  return (
    <div className="adm-content">
      <aside className="adm-panel">
        <div className={`adm-panel-head${dropOn === "" ? " is-drop" : ""}`} {...dropProps("")}>
          <h2>Markdown files</h2>
          {folder && (
            <button type="button" className="adm-link" onClick={() => setFolder("")} title="Create new files at the top level">
              Top level
            </button>
          )}
        </div>
        <ul className="adm-rows adm-tree">
          {renderFolder(tree, 0)}
          {!files.length && !folders.length && <li className="adm-empty">No markdown files yet. Create one below.</li>}
        </ul>

        {folder && (
          <div className="adm-pad adm-folder-bar">
            <span className="adm-muted">
              Folder <strong>{folder}</strong>
            </span>
            <span className="adm-spacer" />
            <button type="button" className="adm-btn is-small" onClick={() => setRenaming({ from: folder, to: folder })}>
              Rename / move
            </button>
            <button type="button" className="adm-btn is-small is-danger" onClick={() => removeFolder(folder)}>
              Delete
            </button>
          </div>
        )}

        <form
          className="adm-pad adm-create"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createFile();
          }}
        >
          <label className="adm-label" htmlFor="adm-new-content">
            New in {folder ? <code>{folder}/</code> : "the top level"}
          </label>
          <input id="adm-new-content" className="adm-input" placeholder="new-page.md or a folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="adm-inline">
            <button type="submit" className="adm-btn is-small" disabled={!newName.trim()}>
              New file
            </button>
            <button type="button" className="adm-btn is-small" disabled={!newName.trim()} onClick={createFolder}>
              New folder
            </button>
          </div>
        </form>
        <p className="adm-hint adm-pad">
          Drag files and folders onto a folder (or onto &ldquo;Markdown files&rdquo;) to move them. Show a file on the site with a Markdown widget; a file with a date in its post details is a blog
          post at <code>/posts/&lt;path&gt;</code>. Files are saved straight to the site; they are not part of the draft.
        </p>
        {!writable && <p className="adm-notice is-warn adm-pad">The content folder is read-only, so files can&apos;t be saved. In Docker, mount src/content without :ro.</p>}
      </aside>

      {name === null ? (
        <div className="adm-center adm-muted">Choose a file to edit.</div>
      ) : (
        <section className="adm-editor">
          <div className="adm-editor-bar">
            {renaming?.from === name ? (
              renameField(name)
            ) : (
              <>
                <strong className="adm-editor-name">{name}</strong>
                <button type="button" className="adm-btn is-small is-ghost" title="Change the name or the folder (type a path like blog/hello.md)" onClick={() => setRenaming({ from: name, to: name })}>
                  Rename / move
                </button>
              </>
            )}
            {message && <span className={message.bad ? "adm-bad" : "adm-muted"}>{message.text}</span>}
            <span className="adm-spacer" />
            <button type="button" className="adm-btn is-danger" onClick={removeFile}>
              Delete file
            </button>
            <button type="button" className="adm-btn is-primary" disabled={!dirty} onClick={save}>
              {dirty ? "Save file" : "Saved"}
            </button>
          </div>
          <div className="adm-editor-panes">
            <MarkdownEditor value={text} onChange={setText} label={`Contents of ${name}`} fileName={name} onSave={save} />
            <div className="adm-markdown prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </section>
      )}
    </div>
  );
}
