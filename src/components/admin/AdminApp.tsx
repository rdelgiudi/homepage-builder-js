"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AdminProvider, useAdmin } from "./store";
import { useBuilder } from "./Builder";
import PreviewPane, { type PreviewDevice } from "./PreviewPane";
import { BackgroundScreen, EffectsScreen, HeaderLayoutScreen, ScopeBar, type ScreenProps, type SettingsScope } from "./ConfigScreens";
import LanguagesScreen from "./LanguagesScreen";
import ContentScreen, { type ContentTarget } from "./ContentScreen";
import CommentsScreen from "./CommentsScreen";
import InboxScreen from "./InboxScreen";
import SuggestionsScreen from "./SuggestionsScreen";
import { HistoryScreen, IntegrationsScreen } from "./OtherScreens";
import { languageName } from "@/lib/i18n/languages";
import { translationStatus } from "@/lib/i18n/texts";
import { forgetContentFiles } from "./SchemaForm";
import { forgetFileLinks, useSiteMap } from "./useSiteMap";

const SCREENS = [
  { id: "builder", label: "Builder" },
  { id: "header-layout", label: "Header & layout" },
  { id: "background", label: "Background" },
  { id: "effects", label: "Effects" },
  { id: "languages", label: "Languages" },
  { id: "content", label: "Content" },
  { id: "comments", label: "Comments" },
  { id: "inbox", label: "Inbox" },
  { id: "suggestions", label: "Suggestions" },
  { id: "integrations", label: "Integrations" },
  { id: "history", label: "History" },
] as const;
type ScreenId = (typeof SCREENS)[number]["id"];

/** Screens that edit the draft and therefore show the live preview. */
const DRAFT_SCREENS: ScreenId[] = ["builder", "header-layout", "background", "effects", "languages"];

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
  // Publishing can move markdown files into their language's folder.
  useEffect(() => {
    forgetContentFiles();
    forgetFileLinks();
  }, [admin.published]);
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [suggested, setSuggested] = useState(0);
  const panels = usePanelWidths();
  // Pages nobody can reach from the homepage, and links to pages that don't exist (lib/pages.ts).
  const map = useSiteMap(admin.config, admin.published.languages.original);
  const stranded = map.unreachable.map((p) => `${p.title} (/${p.slug})`);
  // The same per translation: its markdown files may lack a link the originals have.
  const strandedIn = map.translations.filter((t) => t.unreachable.length).map((t) => `in ${languageName(t.code, "en")}, ${t.unreachable.map((p) => `${p.title} (/${p.slug})`).join(", ")}`);
  const brokenLinks = map.broken.length + map.translations.reduce((n, t) => n + t.broken.length, 0);
  // Header & layout / Background / Effects edit the whole site, or the own settings of the page the builder
  // (and so the preview) shows. Choosing another page there opens it in the builder too.
  const [scopeKind, setScopeKind] = useState<"site" | "page">("site");
  const scope: SettingsScope = scopeKind === "page" ? { kind: "page", ...builder.page } : { kind: "site" };
  // The preview's width, also which of the banner's two sets (wide screens / phones) is edited.
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  // The preview's language, also the one the Languages screen translates into. Falls back to
  // the original when that language is removed.
  const { original, translations } = admin.config.languages;
  const [chosenLang, setLang] = useState<string | null>(null);
  const lang = translations.some((t) => t.code === chosenLang) ? chosenLang! : original;
  // Texts missing in the languages visitors can choose.
  const missing = translations.flatMap((t) => {
    const count = t.enabled ? translationStatus(admin.config, t).count.missing : 0;
    return count ? [{ name: languageName(t.code, "en"), count }] : [];
  });
  /** A file the Languages screen asks the Content screen to open. */
  const [openFile, setOpenFile] = useState<ContentTarget | null>(null);
  const screenProps: ScreenProps = {
    device,
    onDevice: setDevice,
    scope,
    shown: builder.page,
    onScope: (next) => {
      if (next === "site") return setScopeKind("site");
      setScopeKind("page");
      if (next.pageId !== builder.page.id) builder.openPage(next.pageId);
    },
  };

  // The screen lives in the URL hash so a reload stays put.
  useEffect(() => {
    const fromHash = () => {
      // `#site` = the old name of the Header & layout screen (bookmarks).
      const h = window.location.hash.slice(1) === "site" ? "header-layout" : window.location.hash.slice(1);
      if (isScreen(h)) setScreen(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const go = (id: ScreenId) => {
    if (id !== "content") setOpenFile(null);
    window.location.hash = id;
    setScreen(id);
  };

  // Keep the "waiting" and "unread" badges fresh while the panel is open (polled: the public
  // site that receives comments and messages may be a different process).
  const refreshPending = useCallback(() => {
    api<{ counts: { pending: number } }>("comments?status=pending")
      .then((d) => setPending(d.counts.pending))
      .catch(() => {});
    api<{ counts: { unread: number } }>("messages?counts=1")
      .then((d) => setUnread(d.counts.unread))
      .catch(() => {});
    api<{ counts: { unread: number } }>("suggestions?counts=1")
      .then((d) => setSuggested(d.counts.unread))
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
        <button type="button" className="adm-btn is-primary" disabled={!admin.hasDraft || admin.busy || admin.issues.length > 0 || !admin.writable} onClick={() => {
            // Still reading markdown files: wait for the full check rather than publish unchecked.
            if (map.checking) return window.alert("Still checking the links between your pages. Try again in a moment.");
            const lost = [...(stranded.length ? [stranded.join(", ")] : []), ...strandedIn].join("; ");
            if (lost && !window.confirm(`Can't be reached from the homepage, because no link leads there: ${lost}. Publish anyway?`)) return;
            admin.publish();
          }}>
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
            {s.id === "languages" && missing.length > 0 && (
              <span className="adm-count is-draft" title={missing.map((m) => `${m.name}: ${m.count} missing`).join(", ")}>
                ⚠
              </span>
            )}
            {s.id === "comments" && pending > 0 && <span className="adm-count is-draft">{pending}</span>}
            {s.id === "inbox" && unread > 0 && <span className="adm-count is-draft">{unread}</span>}
            {s.id === "suggestions" && suggested > 0 && <span className="adm-count is-draft">{suggested}</span>}
          </button>
        ))}
      </nav>

      {(admin.error || admin.issues.length > 0 || admin.problems.length > 0 || !admin.writable || stranded.length > 0 || strandedIn.length > 0 || brokenLinks > 0) && (
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
          {(stranded.length > 0 || strandedIn.length > 0 || brokenLinks > 0) && (
            <p className="adm-notice is-warn">
              {stranded.length > 0 && (
                <>
                  {stranded.length === 1 ? `The page ${stranded[0]} can't` : `The pages ${stranded.join(", ")} can't`} be reached from the homepage: no link leads there.{" "}
                </>
              )}
              {strandedIn.length > 0 && <>Only {strandedIn.join("; ")} can&apos;t be reached: the translated markdown files don&apos;t link there. </>}
              {brokenLinks > 0 && (
                <>
                  {brokenLinks === 1 ? "1 link points" : `${brokenLinks} links point`} to a page that doesn&apos;t exist.{" "}
                </>
              )}
              {screen !== "builder" && (
                <button type="button" className="adm-link" onClick={() => go("builder")}>
                  Show in the builder
                </button>
              )}
            </p>
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
          {builder.dnd(
            <>
              <aside className="adm-panel">
                {screen === "builder" && builder.outline}
                {screen !== "builder" && screen !== "languages" && <ScopeBar {...screenProps} />}
                {screen === "header-layout" && <HeaderLayoutScreen {...screenProps} />}
                {screen === "background" && <BackgroundScreen {...screenProps} />}
                {screen === "effects" && <EffectsScreen {...screenProps} />}
                {screen === "languages" && (
                  <LanguagesScreen
                    lang={lang}
                    onLang={setLang}
                    onOpenFile={(file) => {
                      setOpenFile(file);
                      go("content");
                    }}
                  />
                )}
              </aside>
              <Resizer side="left" width={panels.widths.left} label="Resize the left panel" onResize={(w) => panels.set("left", w, screen === "builder")} />
              {/* Keep the preview at this position on every draft screen so the iframe is never remounted
                  (which is also why the drag-and-drop context wraps all of them, not just the builder). */}
              <PreviewPane target={builder.previewTarget} drop={builder.previewDrop} editable={screen === "builder"} device={device} onDevice={setDevice} lang={lang} onLang={setLang} />
              {screen === "builder" && (
                <>
                  <Resizer side="right" width={panels.widths.right} label="Resize the settings panel" onResize={(w) => panels.set("right", w, true)} />
                  <aside className="adm-panel">{builder.inspector}</aside>
                </>
              )}
            </>
          )}
        </main>
      ) : (
        <main className="adm-full">
          {screen === "content" && <ContentScreen initial={openFile} />}
          {screen === "comments" && <CommentsScreen onCounts={setPending} />}
          {screen === "inbox" && <InboxScreen onCounts={setUnread} />}
          {screen === "suggestions" && <SuggestionsScreen onCounts={setSuggested} />}
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
