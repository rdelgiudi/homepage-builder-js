"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, timeAgo } from "./api";
import { forgetContentFiles } from "./SchemaForm";
import { forgetFileLinks } from "./useSiteMap";
import { useAdmin } from "./store";
import { allSections, mapSections } from "@/lib/pages";
import { contentLanguages, languageName } from "@/lib/i18n/languages";
import MarkdownEditor from "./MarkdownEditor";
import { baseName, contentTree, dropTarget, foldersBehind, joinPath, languageView, parentOf, type LanguageFile, type TreeFile, type TreeFolder } from "./content-tree";

/** Markdown widgets (in a config) that show one of `names`. */
const usersOf = (config: HomepageConfig, names: Set<string>) =>
  allSections(config).filter((s) => s.type === "markdown" && names.has((s as { file?: string }).file ?? "")).length;

/** What is on disk, with the language folders. */
interface Disk {
  files: TreeFile[];
  folders: string[];
}

/** Drag-and-drop payload type for moving files and folders in the tree. */
const DRAG_TYPE = "application/x-homepage-content";

interface OpenFile {
  /** Without the language folder. */
  name: string;
  lang: string;
  state: LanguageFile["state"];
  /** The language of the text it was opened with. */
  shownIn: string;
  /** Where saving writes: fixed when the file is opened, so a language removed meanwhile (Undo) can't redirect it. */
  path: string;
}

/** What the Languages screen asks to open. */
export interface ContentTarget {
  name: string;
  lang: string;
}

const inEnglish = (code: string) => languageName(code, "en");

/**
 * Markdown files: one tree for every language, with a language picker above it once there is
 * more than one. Files and folders are managed in the original; a translation has the same tree.
 */
export default function ContentScreen({ initial }: { initial?: ContentTarget | null }) {
  const { config, published, update } = useAdmin();
  const [disk, setDisk] = useState<Disk>({ files: [], folders: [] });
  const [writable, setWritable] = useState(true);
  const languages = useMemo(() => contentLanguages(config.languages, published.languages.original), [config.languages, published.languages.original]);
  const { original } = languages;
  const [chosenLang, setLang] = useState(initial?.lang ?? original);
  const [doc, setDoc] = useState<OpenFile | null>(null);
  const name = doc?.name ?? null;
  /** Where "New file" / "New folder" create things ("" = the top level). */
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

  const viewIn = useCallback((d: Disk, code: string) => languageView(d.files, d.folders, languages, code), [languages]);
  const base = useMemo(() => viewIn(disk, original), [viewIn, disk, original]);
  // A language can disappear (Undo): back to the original.
  const lang = base.codes.includes(chosenLang) ? chosenLang : original;
  const view = useMemo(() => viewIn(disk, lang), [viewIn, disk, lang]);
  const translating = lang !== original;
  const files = view.files;
  const byName = useMemo(() => new Map(files.map((f) => [f.name, f])), [files]);
  const tree = useMemo(() => contentTree(view.files, view.folders), [view]);
  /** Names Markdown widgets show (a name written with the original's folder is the same file). */
  const inUse = useMemo(
    () => new Set(allSections(config).flatMap((s) => (s.type === "markdown" ? [((s as { file?: string }).file ?? "").replace(new RegExp(`^${original}/`), "")] : []))),
    [config, original]
  );
  /** A name, and how a config may also spell it. */
  const spellings = (list: string[]) => new Set(list.flatMap((n) => [n, `${original}/${n}`]));

  const loadList = useCallback(async () => {
    const data = await api<Disk & { writable: boolean }>("content");
    setDisk({ files: data.files, folders: data.folders });
    setWritable(data.writable);
    forgetContentFiles();
    // Links inside files count for the site map (pages reachable from the homepage).
    forgetFileLinks();
    return data as Disk;
  }, []);

  /** Opens a file in a language; without a translation it starts from the original's text. */
  const open = useCallback(
    async (d: Disk, file: string, code: string) => {
      const entry = viewIn(d, code).files.find((f) => f.name === file);
      if (!entry) return setDoc(null);
      try {
        const data = await api<{ content: string }>(`content?file=${encodeURIComponent(entry.path)}`);
        setDoc({ name: file, lang: code, state: entry.state, shownIn: entry.shownIn, path: entry.saveTo });
        setFolder(parentOf(file));
        setText(data.content);
        setSavedText(data.content);
        setMessage(null);
      } catch (err) {
        setMessage({ text: (err as Error).message, bad: true });
      }
    },
    [viewIn]
  );

  // Once: later changes of `open` (the languages change with every edit of a translation) must not reopen anything.
  const start = useRef({ initial, lang, open });
  useEffect(() => {
    const { initial: target, lang: code, open: openFile } = start.current;
    loadList()
      .then((d) => {
        const list = viewIn(d, code).files;
        const first = list.find((f) => f.name === target?.name) ?? list[0];
        if (first) openFile(d, first.name, code);
      })
      .catch((err) => setMessage({ text: (err as Error).message, bad: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadList]);

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

  const chooseLang = (code: string) => {
    if (!leaveOk()) return;
    setLang(code);
    setRenaming(null);
    if (name) open(disk, name, code);
  };

  const save = async () => {
    if (!doc || !dirty) return;
    try {
      await api("content", { method: "PUT", body: { file: doc.path, content: text } });
      setSavedText(text);
      if (doc.state === "missing") setDoc({ ...doc, state: "own", shownIn: doc.lang });
      setMessage({ text: "Saved. Visitors see it within 5 minutes (pages cache markdown)." });
      loadList();
    } catch (err) {
      fail(err);
    }
  };

  const createFile = async () => {
    const typed = newName.trim().replace(/^\/+/, "");
    const file = joinPath(folder, typed.endsWith(".md") ? typed : `${typed}.md`);
    if (byName.has(file)) return setMessage({ text: `${file} already exists.`, bad: true });
    if (!leaveOk()) return;
    try {
      await api("content", { method: "PUT", body: { file: base.base + file, content: `# ${baseName(file).replace(/\.md$/, "")}\n` } });
      setNewName("");
      await open(await loadList(), file, original);
    } catch (err) {
      fail(err);
    }
  };

  const createFolder = async () => {
    const path = joinPath(folder, newName.trim().replace(/^\/+|\/+$/g, ""));
    try {
      await api("content", { method: "PUT", body: { folder: base.base + path } });
      setNewName("");
      setFolder(path);
      await loadList();
      setMessage({ text: `Folder ${path} created. New files go into it.` });
    } catch (err) {
      fail(err);
    }
  };

  /**
   * Renames or moves a file or folder (in the original; the server takes translations along).
   * Markdown widgets in the draft that show a moved file are pointed at its new name (one undo
   * step); the live site keeps the old names until Publish.
   */
  const move = async (from: string, to: string) => {
    if (from === to) return setRenaming(null);
    const isFile = from.endsWith(".md");
    if (isFile && from === name && !leaveOk()) return;
    const path = byName.get(from)?.path;
    try {
      if (isFile) {
        if (path) await api("content", { method: "PATCH", body: { from: path, to: path.slice(0, path.length - from.length) + to } });
      } else {
        // The folder can be in several languages' folders. Moving it in one takes every file's other
        // languages along, so look again before each: what is left may be empty folders.
        for (const source of foldersBehind(from, disk.folders, languages, base.codes)) {
          const now = await api<Disk>("content");
          if (!now.folders.includes(source)) continue;
          if (now.files.some((f) => f.name.startsWith(`${source}/`)) || source === base.base + from) await api("content", { method: "PATCH", body: { from: source, to: source.slice(0, source.length - from.length) + to } });
          else await api(`content?folder=${encodeURIComponent(source)}`, { method: "DELETE" });
        }
      }
      setRenaming(null);
      const map = new Map(isFile ? [[from, to]] : files.filter((f) => f.name.startsWith(`${from}/`)).map((f) => [f.name, to + f.name.slice(from.length)]));
      const renamed = (file: string) => map.get(file) ?? (file.startsWith(`${original}/`) ? map.get(file.slice(original.length + 1)) : undefined);
      const used = usersOf(config, spellings([...map.keys()]));
      const live = usersOf(published, spellings([...map.keys()]));
      if (used) {
        update((c) =>
          mapSections(c, (s) => {
            const file = s.type === "markdown" ? (s as { file?: string }).file : undefined;
            const next = file && renamed(file);
            return next ? ({ ...s, file: next } as typeof s) : s;
          })
        );
      }
      const d = await loadList();
      if (doc && map.has(doc.name)) {
        // Same text, new place: what is typed stays.
        const entry = viewIn(d, doc.lang).files.find((f) => f.name === map.get(doc.name));
        if (entry) setDoc({ ...doc, name: entry.name, path: entry.saveTo, state: entry.state, shownIn: entry.shownIn });
        if (!isFile) setFolder(parentOf(map.get(doc.name)!));
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

  const closeDoc = (d: Disk, code: string) => {
    setDoc(null);
    setText("");
    setSavedText("");
    setHtml("");
    const [first] = viewIn(d, code).files;
    if (first) open(d, first.name, code);
  };

  /** In the original: the file in every language. In a translation: only that. */
  const removeFile = async () => {
    if (!doc) return;
    const own = doc.lang === original;
    const translations = own ? base.codes.filter((c) => c !== original && disk.files.some((f) => f.name === `${c}/${doc.name}`)) : [];
    const used = own ? usersOf(config, spellings([doc.name])) : 0;
    const question = own
      ? `Delete ${doc.name}?${translations.length ? ` Its ${translations.map(inEnglish).join(", ")} translation${translations.length === 1 ? "" : "s"} will be deleted too.` : ""}${used ? ` ${used} Markdown widget${used === 1 ? " uses" : "s use"} it and will show "File not found".` : ""}`
      : `Delete the ${inEnglish(doc.lang)} translation of ${doc.name}? Visitors will see the original.`;
    if (!window.confirm(question)) return;
    try {
      for (const file of [doc.path, ...translations.map((c) => `${c}/${doc.name}`)]) await api(`content?file=${encodeURIComponent(file)}`, { method: "DELETE" });
      const d = await loadList();
      if (!own && viewIn(d, doc.lang).files.some((f) => f.name === doc.name)) open(d, doc.name, doc.lang);
      else closeDoc(d, lang);
    } catch (err) {
      fail(err);
    }
  };

  const removeFolder = async (path: string) => {
    const inside = files.filter((f) => f.name.startsWith(`${path}/`));
    const used = usersOf(config, spellings(inside.map((f) => f.name)));
    const behind = foldersBehind(path, disk.folders, languages, base.codes);
    const what = inside.length ? ` and the ${inside.length} file${inside.length === 1 ? "" : "s"} in it${base.codes.length > 1 ? ", in every language" : ""}` : "";
    if (!window.confirm(`Delete the folder ${path}${what}?${used ? ` ${used} Markdown widget${used === 1 ? " uses" : "s use"} them and will show "File not found".` : ""}`)) return;
    if (name?.startsWith(`${path}/`) && dirty && !window.confirm("The open file has unsaved changes. Delete anyway?")) return;
    try {
      for (const f of behind) await api(`content?folder=${encodeURIComponent(f)}`, { method: "DELETE" });
      setFolder(parentOf(path));
      const d = await loadList();
      if (name?.startsWith(`${path}/`)) closeDoc(d, lang);
    } catch (err) {
      fail(err);
    }
  };

  // --- drag a file or folder onto a folder (or the top of the list) to move it there ---
  const dragProps = (item: string) => ({
    draggable: writable && !translating,
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
            <button type="button" className="adm-row-button" onClick={() => f.name !== name && leaveOk() && open(disk, f.name, lang)}>
              <span className="adm-row-text">
                <span className="adm-row-title">{baseName(f.name)}</span>
                {byName.get(f.name)?.state !== "missing" && <span className="adm-row-sub">edited {timeAgo(f.modifiedAt)}</span>}
              </span>
              {byName.get(f.name)?.state === "missing" && <span className="adm-tag is-draft">{translating ? "⚠ Not translated" : `⚠ Only in ${inEnglish(byName.get(f.name)!.shownIn)}`}</span>}
              {inUse.has(f.name) && !translating && (
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
        {base.codes.length > 1 && (
          <div className="adm-pad adm-content-lang">
            <label className="adm-label" htmlFor="adm-content-lang">
              Language
            </label>
            <select id="adm-content-lang" className="adm-input" value={lang} onChange={(e) => chooseLang(e.target.value)}>
              {base.codes.map((code) => {
                const list = viewIn(disk, code).files;
                return (
                  <option key={code} value={code}>
                    {inEnglish(code)}
                    {code === original ? " (original)" : ` (${list.filter((f) => f.state === "own").length} of ${base.files.length})`}
                    {code !== original && !languages.codes.includes(code) ? ", not a language of the site" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}
        <ul className="adm-rows adm-tree">
          {renderFolder(tree, 0)}
          {!files.length && !view.folders.length && <li className="adm-empty">No markdown files yet. Create one below.</li>}
        </ul>

        {folder && !translating && (
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

        {translating && (
          <p className="adm-hint adm-pad">
            Choose a file to translate it. Files and folders are added, renamed and deleted in{" "}
            <button type="button" className="adm-link" onClick={() => chooseLang(original)}>
              {inEnglish(original)}
            </button>
            ; translations follow.
          </p>
        )}
        {!translating && (
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
        )}
        {!translating && (
          <p className="adm-hint adm-pad">
            Drag files and folders onto a folder (or onto &ldquo;Markdown files&rdquo;) to move them. Show a file on the site with a Markdown widget; a file with a date in its post details is a blog
            post at <code>/posts/&lt;path&gt;</code>. Files are saved straight to the site; they are not part of the draft.
          </p>
        )}
        {base.shadowed.length > 0 && (
          <div className="adm-notice is-warn adm-pad">
            Never shown, because another file has the same name:
            <ul>
              {base.shadowed.map((f) => (
                <li key={f}>
                  <code>{f}</code>{" "}
                  <button
                    type="button"
                    className="adm-link"
                    onClick={() =>
                      window.confirm(`Delete ${f}? The file shown under this name stays.`) &&
                      api(`content?file=${encodeURIComponent(f)}`, { method: "DELETE" }).then(loadList).catch(fail)
                    }
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!writable && <p className="adm-notice is-warn adm-pad">The content folder is read-only, so files can&apos;t be saved. In Docker, mount src/content without :ro.</p>}
      </aside>

      {doc === null || name === null ? (
        <div className="adm-center adm-muted">Choose a file to edit.</div>
      ) : (
        <section className="adm-editor">
          <div className="adm-editor-bar">
            {renaming?.from === name ? (
              renameField(name)
            ) : (
              <>
                <strong className="adm-editor-name">{name}</strong>
                {base.codes.length > 1 && <span className="adm-tag">{inEnglish(doc.lang)}</span>}
                {doc.state === "missing" && <span className="adm-tag is-draft">{doc.lang === original ? `⚠ Only in ${inEnglish(doc.shownIn)}` : "⚠ Not translated"}</span>}
                {!translating && (
                  <button type="button" className="adm-btn is-small is-ghost" title="Change the name or the folder (type a path like blog/hello.md)" onClick={() => setRenaming({ from: name, to: name })}>
                    Rename / move
                  </button>
                )}
              </>
            )}
            {message && <span className={message.bad ? "adm-bad" : "adm-muted"}>{message.text}</span>}
            <span className="adm-spacer" />
            {doc.state !== "missing" && (
              <button type="button" className="adm-btn is-danger" onClick={removeFile}>
                {doc.lang === original ? "Delete file" : "Delete translation"}
              </button>
            )}
            <button type="button" className="adm-btn is-primary" disabled={!dirty} onClick={save}>
              {doc.state === "missing" ? `Save ${inEnglish(doc.lang)} version` : dirty ? "Save file" : "Saved"}
            </button>
          </div>
          {doc.state === "missing" && (
            <p className="adm-notice is-warn adm-editor-notice">
              No {inEnglish(doc.lang)} version yet: visitors see the {inEnglish(doc.shownIn)} one. This is its text; translate it here and save.
            </p>
          )}
          <div className="adm-editor-panes">
            <MarkdownEditor value={text} onChange={setText} key={`${doc.lang}/${name}`} label={`Contents of ${name}`} fileName={name} onSave={save} />
            <div className="adm-markdown prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </section>
      )}
    </div>
  );
}
