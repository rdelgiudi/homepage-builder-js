"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AdminProvider, useAdmin } from "./store";
import { useBuilder } from "./Builder";
import PreviewPane from "./PreviewPane";
import { BackgroundScreen, EffectsScreen, SiteScreen } from "./ConfigScreens";
import ContentScreen from "./ContentScreen";
import CommentsScreen from "./CommentsScreen";
import { HistoryScreen, IntegrationsScreen } from "./OtherScreens";

const SCREENS = [
  { id: "builder", label: "Builder" },
  { id: "site", label: "Site" },
  { id: "background", label: "Background" },
  { id: "effects", label: "Effects" },
  { id: "content", label: "Content" },
  { id: "comments", label: "Comments" },
  { id: "integrations", label: "Integrations" },
  { id: "history", label: "History" },
] as const;
type ScreenId = (typeof SCREENS)[number]["id"];

/** Screens that edit the draft and therefore show the live preview. */
const DRAFT_SCREENS: ScreenId[] = ["builder", "site", "background", "effects"];

const isScreen = (s: string): s is ScreenId => SCREENS.some((x) => x.id === s);

// --- resizable side panels ---

const PANEL_DEFAULTS = { left: 310, right: 340 };
const PANEL_MIN = 240;
const PANEL_MAX = 760;
/** The preview never gets squeezed below this, whatever the panels ask for. */
const PREVIEW_MIN = 320;
const WIDTHS_KEY = "admin.panelWidths";
type Side = keyof typeof PANEL_DEFAULTS;

/** Side panel widths, remembered in this browser. */
function usePanelWidths() {
  const [widths, setWidths] = useState(PANEL_DEFAULTS);

  // Read after mount so the server-rendered markup and the first client render agree.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? "null");
      if (stored && Number.isFinite(stored.left) && Number.isFinite(stored.right)) setWidths({ left: stored.left, right: stored.right });
    } catch {}
  }, []);

  const set = useCallback((side: Side, wanted: number, otherVisible: boolean) => {
    setWidths((w) => {
      const other = otherVisible ? w[side === "left" ? "right" : "left"] : 0;
      const room = Math.max(PANEL_MIN, window.innerWidth - other - PREVIEW_MIN);
      const next = { ...w, [side]: Math.round(Math.min(Math.max(wanted, PANEL_MIN), PANEL_MAX, room)) };
      try {
        localStorage.setItem(WIDTHS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { widths, set };
}

/** The draggable divider between a side panel and the preview. */
function Resizer({ side, width, onResize, label }: { side: Side; width: number; onResize: (width: number) => void; label: string }) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  // Dragging away from the panel's outer edge makes it wider.
  const direction = side === "left" ? 1 : -1;
  return (
    <div
      className="adm-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={(e) => {
        // Capture keeps the drag alive while the pointer is over the preview iframe.
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, width };
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (drag.current) onResize(drag.current.width + (e.clientX - drag.current.x) * direction);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onResize(PANEL_DEFAULTS[side])}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === "ArrowRight") onResize(width + step * direction);
        else if (e.key === "ArrowLeft") onResize(width - step * direction);
        else if (e.key === "Home") onResize(PANEL_DEFAULTS[side]);
        else return;
        e.preventDefault();
      }}
    />
  );
}

function StatusPill() {
  const { hasDraft, saveState, issues } = useAdmin();
  if (issues.length) return <span className="adm-pill is-bad">Draft not saved: {issues.length} problem{issues.length === 1 ? "" : "s"}</span>;
  if (saveState === "saving") return <span className="adm-pill is-draft">Saving draft…</span>;
  if (hasDraft) return <span className="adm-pill is-draft">Draft saved, not live yet</span>;
  return <span className="adm-pill is-live">Live, no unpublished changes</span>;
}

function Shell() {
  const admin = useAdmin();
  const builder = useBuilder();
  const [screen, setScreen] = useState<ScreenId>("builder");
  const [pending, setPending] = useState(0);
  const panels = usePanelWidths();

  // The screen lives in the URL hash so a reload stays put.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (isScreen(h)) setScreen(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const go = (id: ScreenId) => {
    window.location.hash = id;
    setScreen(id);
  };

  // Keep the "waiting" badge fresh while the panel is open.
  const refreshPending = useCallback(() => {
    api<{ counts: { pending: number } }>("comments?status=pending")
      .then((d) => setPending(d.counts.pending))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshPending();
    const timer = setInterval(refreshPending, 30000);
    return () => clearInterval(timer);
  }, [refreshPending]);

  const signOut = async () => {
    await api("logout", { method: "POST", body: {} }).catch(() => {});
    window.location.href = "/admin/login";
  };

  const showsPreview = DRAFT_SCREENS.includes(screen);

  return (
    <>
      <header className="adm-top">
        <a className="adm-brand" href="/" target="_blank" rel="noreferrer" title="Open the live site in a new tab">
          {admin.published.name}
        </a>
        <StatusPill />
        <span className="adm-spacer" />
        <button type="button" className="adm-btn is-ghost" disabled={!admin.canUndo} onClick={admin.undo}>
          Undo
        </button>
        <button type="button" className="adm-btn is-ghost" disabled={!admin.canRedo} onClick={admin.redo}>
          Redo
        </button>
        <button type="button" className="adm-btn" disabled={!admin.hasDraft || admin.busy} onClick={() => window.confirm("Discard the draft and go back to what is live?") && admin.discard()}>
          Discard draft
        </button>
        <button type="button" className="adm-btn is-primary" disabled={!admin.hasDraft || admin.busy || admin.issues.length > 0 || !admin.writable} onClick={admin.publish}>
          {admin.busy ? "Publishing…" : "Publish"}
        </button>
        <button type="button" className="adm-btn is-ghost" onClick={signOut}>
          Sign out
        </button>
      </header>

      <nav className="adm-nav" aria-label="Admin sections">
        {SCREENS.map((s) => (
          <button key={s.id} type="button" aria-current={s.id === screen ? "page" : undefined} onClick={() => go(s.id)}>
            {s.label}
            {s.id === "comments" && pending > 0 && <span className="adm-count is-draft">{pending}</span>}
          </button>
        ))}
      </nav>

      {(admin.error || admin.issues.length > 0 || admin.problems.length > 0 || !admin.writable) && (
        <div className="adm-banners">
          {admin.error && (
            <p className="adm-notice is-bad">
              {admin.error}{" "}
              <button type="button" className="adm-link" onClick={admin.clearError}>
                Dismiss
              </button>
            </p>
          )}
          {admin.issues.length > 0 && (
            <div className="adm-notice is-bad">
              Fix these to save the draft:
              <ul>
                {admin.issues.map((i, n) => (
                  <li key={n}>
                    <code>{i.path}</code> {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!admin.writable && <p className="adm-notice is-warn">homepage.json is read-only, so publishing is turned off. In Docker, mount src/config without :ro.</p>}
          {admin.problems.length > 0 && (
            <div className="adm-notice is-warn">
              The config file on disk has problems. Publishing replaces it with a clean version.
              <ul>
                {admin.problems.map((p, n) => (
                  <li key={n}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showsPreview ? (
        <main
          className="adm-work"
          style={{ gridTemplateColumns: `${panels.widths.left}px auto minmax(0, 1fr)${screen === "builder" ? ` auto ${panels.widths.right}px` : ""}` }}
        >
          <aside className="adm-panel">
            {screen === "builder" && builder.outline}
            {screen === "site" && <SiteScreen />}
            {screen === "background" && <BackgroundScreen />}
            {screen === "effects" && <EffectsScreen />}
          </aside>
          <Resizer side="left" width={panels.widths.left} label="Resize the left panel" onResize={(w) => panels.set("left", w, screen === "builder")} />
          {/* Keep the preview at this position on every draft screen so the iframe is never remounted. */}
          <PreviewPane tabSlug={builder.tabSlug} />
          {screen === "builder" && (
            <>
              <Resizer side="right" width={panels.widths.right} label="Resize the settings panel" onResize={(w) => panels.set("right", w, true)} />
              <aside className="adm-panel">{builder.inspector}</aside>
            </>
          )}
        </main>
      ) : (
        <main className="adm-full">
          {screen === "content" && <ContentScreen />}
          {screen === "comments" && <CommentsScreen onCounts={setPending} />}
          {screen === "integrations" && <IntegrationsScreen />}
          {screen === "history" && <HistoryScreen onLoaded={() => go("builder")} />}
        </main>
      )}
    </>
  );
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <Shell />
    </AdminProvider>
  );
}
