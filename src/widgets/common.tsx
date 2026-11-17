import { useEffect, useRef, useState, type ReactNode } from "react";

/** The card surface the data widgets share (same colours as the GitHub cards). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-[#2b2d31] rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>{children}</div>;
}

/** A quiet line for "not set up yet", "nothing to show" and errors. */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="italic text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  );
}

interface WidgetData<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads `{ data }` from one of this site's widget endpoints. `url = null` means "not set up yet".
 * `refreshMs` reloads it on that interval while the page is visible (keeping the old data on
 * screen meanwhile) — for things that change while someone is looking, like a live stream.
 */
export function useWidgetData<T>(url: string | null, refreshMs?: number): WidgetData<T> {
  const [state, setState] = useState<WidgetData<T>>({ data: null, error: null, loading: !!url });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url || !refreshMs) return;
    const timer = setInterval(() => !document.hidden && setTick((n) => n + 1), refreshMs);
    return () => clearInterval(timer);
  }, [url, refreshMs]);
  const loadedUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!url) {
      loadedUrl.current = null;
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    // A failed refresh of the same address keeps what is on screen.
    const refresh = loadedUrl.current === url;
    const fail = (error: string) => setState((s) => (refresh && s.data ? { ...s, loading: false } : { data: null, error, loading: false }));
    setState((s) => ({ ...s, loading: true, error: refresh ? s.error : null }));
    fetch(url)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        loadedUrl.current = url;
        if (res.ok && body.data) setState({ data: body.data as T, error: null, loading: false });
        else fail(body.error || "Could not load this widget.");
      })
      .catch(() => !cancelled && fail("Could not load this widget."));
    return () => {
      cancelled = true;
    };
  }, [url, tick]);
  return state;
}

/** Card wrapper that handles the three states every data widget has before it can show anything. */
export function DataCard<T>({ state, setup, lines, children }: { state: WidgetData<T>; setup?: string | false; lines?: number; children: (data: T) => ReactNode }) {
  if (setup) return <Card><Notice>{setup}</Notice></Card>;
  if (state.loading && !state.data) return <Card><Skeleton lines={lines} /></Card>;
  if (state.error || !state.data) return <Card><Notice>{state.error ?? "Nothing to show."}</Notice></Card>;
  return <Card>{children(state.data)}</Card>;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
