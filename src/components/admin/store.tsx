"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, ApiError, type ConfigIssue } from "./api";
import { sameConfig } from "./same";
import { TYPING_IDLE_MS, endsStep, isLongText, isTypingField, wordsAtStart } from "./typing-history";

type SaveState = "idle" | "saving" | "saved" | "error";

interface AdminStore {
  /** The config being edited. Equal to `published` when there is no draft. */
  config: HomepageConfig;
  published: HomepageConfig;
  /** True when `config` differs from what is live. */
  hasDraft: boolean;
  saveState: SaveState;
  /** Why the draft can't be saved (validation problems). */
  issues: ConfigIssue[];
  /** Problems with homepage.json on disk. */
  problems: string[];
  writable: boolean;
  /** Bumps every time the draft has been saved — the preview re-renders on it. */
  savedTick: number;
  update: (fn: (config: HomepageConfig) => HomepageConfig) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  publish: () => Promise<void>;
  discard: () => Promise<void>;
  /** Replace the draft wholesale (e.g. after loading an earlier version). */
  replace: (config: HomepageConfig) => void;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

const Ctx = createContext<AdminStore | null>(null);

export function useAdmin(): AdminStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("useAdmin outside AdminProvider");
  return store;
}

/** Key order doesn't count (see same.ts): re-setting a key moves it, which isn't a change. */
const same = sameConfig;
const SAVE_DELAY_MS = 500;
const MAX_UNDO = 50;

interface LoadResponse {
  published: HomepageConfig;
  draft: HomepageConfig | null;
  problems: string[];
  writable: boolean;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<HomepageConfig | null>(null);
  // The edited config and its undo history change together, so they live in one state value.
  // `group`: the typing step the newest undo entry belongs to (null = a normal edit), see `update`.
  const [doc, setDoc] = useState<{ config: HomepageConfig; past: HomepageConfig[]; future: HomepageConfig[]; group: number | null } | null>(null);
  const config = doc?.config ?? null;
  const [problems, setProblems] = useState<string[]>([]);
  const [writable, setWritable] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [savedTick, setSavedTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** What the server currently holds as the draft (`null` = none). Avoids redundant saves. */
  const serverDraft = useRef<HomepageConfig | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    api<LoadResponse>("config")
      .then((data) => {
        setPublished(data.published);
        setDoc({ config: data.draft ?? data.published, past: [], future: [], group: null });
        serverDraft.current = data.draft;
        setProblems(data.problems);
        setWritable(data.writable);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load the config."));
  }, []);

  /** Brings the server's draft in line with `next`. Resolves when done; never rejects. */
  const save = useCallback((next: HomepageConfig, live: HomepageConfig) => {
    saving.current = saving.current.then(async () => {
      const target = same(next, live) ? null : next;
      if (same(target, serverDraft.current)) {
        // Back in sync without a request (e.g. an invalid edit was undone) — nothing is wrong any more.
        setIssues([]);
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      try {
        if (target) await api("config", { method: "PUT", body: { config: target } });
        else await api("config", { method: "DELETE" });
        serverDraft.current = target;
        setIssues([]);
        setSaveState("saved");
        setSavedTick((t) => t + 1);
      } catch (err) {
        setIssues(err instanceof ApiError ? err.issues : []);
        setSaveState("error");
        if (!(err instanceof ApiError) || !err.issues.length) setError(err instanceof Error ? err.message : "Could not save the draft.");
      }
    });
    return saving.current;
  }, []);

  // Autosave, debounced.
  useEffect(() => {
    if (!config || !published) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(config, published), SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [config, published, save]);

  // --- typing = one undo step per burst (rules in typing-history.ts) ---
  // Edits made while typing into one field share a step until a pause, leaving the field, or
  // (bigger fields) a few words. Detected here from the event being handled, so the form
  // controls and all callers of `update` need nothing special.
  const typing = useRef<{ el: Element; id: number; startWords: number } | null>(null);
  const typingIds = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Sets a new config and records the old one for undo. */
  const push = useCallback((next: HomepageConfig) => {
    typing.current = null;
    setDoc((d) => (d && !same(next, d.config) ? { config: next, past: [...d.past.slice(-MAX_UNDO + 1), d.config], future: [], group: null } : d));
  }, []);

  /** Ends the current typing step: the next keystroke starts a new undo entry. */
  const checkpoint = useCallback(() => {
    typing.current = null;
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);
  useEffect(() => {
    document.addEventListener("focusout", checkpoint);
    return () => {
      document.removeEventListener("focusout", checkpoint);
      checkpoint();
    };
  }, [checkpoint]);

  /** The typing step this edit belongs to, or null when it isn't typing (a click, a drag, an upload finishing). */
  const typingStep = (): number | null => {
    const el = document.activeElement as (HTMLInputElement | HTMLTextAreaElement) | null;
    // Only edits made while an `input` event is being handled count, so an async edit (an
    // upload that finishes) never joins the step of the field that happens to have focus.
    if (window.event?.type !== "input" || !isTypingField(el) || !el) {
      checkpoint();
      return null;
    }
    let caret = el.value.length;
    try {
      caret = el.selectionStart ?? caret; // null for number / color / range inputs
    } catch {}
    if (typing.current?.el !== el) typing.current = { el, id: ++typingIds.current, startWords: wordsAtStart(el.value, caret) };
    const step = typing.current;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(checkpoint, TYPING_IDLE_MS);
    // This edit still joins the step; the next keystroke starts a new one.
    if (endsStep(step.startWords, el.value, caret, isLongText(el.tagName, el.value))) checkpoint();
    return step.id;
  };

  const update = useCallback((fn: (c: HomepageConfig) => HomepageConfig) => {
    const group = typingStep();
    setDoc((d) => {
      if (!d) return d;
      const next = fn(d.config);
      if (same(next, d.config)) return d;
      // Same typing step as the newest undo entry: replace the config, keep the entry.
      if (group !== null && d.group === group) return { ...d, config: next, future: [] };
      return { config: next, past: [...d.past.slice(-MAX_UNDO + 1), d.config], future: [], group };
    });
    // typingStep only reads refs; the eslint rule can't see that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = useCallback(() => {
    typing.current = null;
    setDoc((d) => (d && d.past.length ? { config: d.past[d.past.length - 1], past: d.past.slice(0, -1), future: [d.config, ...d.future], group: null } : d));
  }, []);

  const redo = useCallback(() => {
    typing.current = null;
    setDoc((d) => (d && d.future.length ? { config: d.future[0], past: [...d.past, d.config], future: d.future.slice(1), group: null } : d));
  }, []);

  const publish = useCallback(async () => {
    if (!config || !published) return;
    setBusy(true);
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await save(config, published);
      if (!same(serverDraft.current, config)) return; // save failed; issues are already shown
      const res = await api<{ published: HomepageConfig }>("config/publish", { method: "POST", body: {} });
      serverDraft.current = null;
      setPublished(res.published);
      setDoc((d) => (d ? { ...d, config: res.published } : d));
      setProblems([]);
      setSaveState("idle");
    } catch (err) {
      if (err instanceof ApiError && err.issues.length) setIssues(err.issues);
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }, [config, published, save]);

  const discard = useCallback(async () => {
    if (!published) return;
    setBusy(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saving.current;
      push(published);
      await save(published, published);
    } finally {
      setBusy(false);
    }
  }, [published, save, push]);

  const replace = useCallback(
    (next: HomepageConfig) => {
      // The server already stored it as the draft.
      serverDraft.current = next;
      push(next);
      setSavedTick((t) => t + 1);
    },
    [push]
  );

  const store = useMemo<AdminStore | null>(() => {
    if (!config || !published) return null;
    return {
      config,
      published,
      hasDraft: !same(config, published),
      saveState,
      issues,
      problems,
      writable,
      savedTick,
      update,
      canUndo: doc!.past.length > 0,
      canRedo: doc!.future.length > 0,
      undo,
      redo,
      publish,
      discard,
      replace,
      busy,
      error,
      clearError: () => setError(null),
    };
  }, [config, published, saveState, issues, problems, writable, savedTick, update, doc, undo, redo, publish, discard, replace, busy, error]);

  if (loadError) return <div className="adm-center">{loadError}</div>;
  if (!store) return <div className="adm-center adm-muted">Loading your site…</div>;
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
