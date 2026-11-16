"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, ApiError, type ConfigIssue } from "./api";

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

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
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
  const [doc, setDoc] = useState<{ config: HomepageConfig; past: HomepageConfig[]; future: HomepageConfig[] } | null>(null);
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
        setDoc({ config: data.draft ?? data.published, past: [], future: [] });
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

  /** Sets a new config and records the old one for undo. */
  const push = useCallback((next: HomepageConfig) => {
    setDoc((d) => (d && !same(next, d.config) ? { config: next, past: [...d.past.slice(-MAX_UNDO + 1), d.config], future: [] } : d));
  }, []);

  const update = useCallback((fn: (c: HomepageConfig) => HomepageConfig) => {
    setDoc((d) => {
      if (!d) return d;
      const next = fn(d.config);
      return same(next, d.config) ? d : { config: next, past: [...d.past.slice(-MAX_UNDO + 1), d.config], future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setDoc((d) => (d && d.past.length ? { config: d.past[d.past.length - 1], past: d.past.slice(0, -1), future: [d.config, ...d.future] } : d));
  }, []);

  const redo = useCallback(() => {
    setDoc((d) => (d && d.future.length ? { config: d.future[0], past: [...d.past, d.config], future: d.future.slice(1) } : d));
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
