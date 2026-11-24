"use client";

import { useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { MAX_PAGE_DEPTH, PAGE_SEGMENT, PAGE_SLUG, isReservedSlug, type HomepageConfig, type Page } from "@/lib/schema/config";
import { HOME, pagePath, parentAddress, type PageLink, type SiteMap, type SitePage, type TranslationLinks } from "@/lib/pages";
import { languageName } from "@/lib/i18n/languages";
import { widgetMetaByType } from "@/widgets/meta";
import SchemaForm from "./SchemaForm";
import { formSchemas } from "./schemas";

type Obj = Record<string, unknown>;

/** Droppable id prefix of a page row: a widget dropped there moves to that page's first tab. */
export const PAGE_DROP = "page:";

const pageName = (map: SiteMap, slug: string) => map.pages.find((p) => p.slug === slug)?.title ?? pagePath(slug);

/** "the Links widget on Home" / "about.md (Markdown widget) on Page 2". */
export function describeLink(map: SiteMap, l: PageLink): string {
  const widget = widgetMetaByType[l.sectionType]?.label ?? "a widget";
  return `${l.file ? `${l.file}${l.lang ? ` in ${languageName(l.lang, "en")}` : ""} (${widget} widget)` : `the ${widget} widget`} on ${pageName(map, l.from)}`;
}

/** One page in the tree: opens it, has a settings button, and takes widgets dropped on it. */
function PageRow({ page, depth, warn, current, settings, onOpen, onSettings }: { page: SitePage; depth: number; warn: boolean; current: boolean; settings: boolean; onOpen: (id: string) => void; onSettings: (id: string) => void }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: PAGE_DROP + page.id });
  // Only widgets and palette items can be dropped on a page (a dragged tab never targets it).
  const widgetOver = isOver && !!active && !String(active.id).startsWith("tab:");
  return (
    <li
      ref={setNodeRef}
      className={`adm-row is-static adm-page-row${current ? " is-selected" : ""}${warn ? " is-warn" : ""}${widgetOver ? " is-drop" : ""}`}
      style={{ paddingLeft: 6 + depth * 16 }}
      title={widgetOver ? `Drop to move it to ${page.title}` : undefined}
    >
      <button type="button" className="adm-row-button" onClick={() => onOpen(page.id)} title={`Edit ${page.title} (${pagePath(page.slug)})`}>
        <span className="adm-row-icon" aria-hidden>
          {page.id === HOME ? "🏠" : warn ? "⚠️" : "📄"}
        </span>
        <span className="adm-row-text">
          <span className="adm-row-title">{page.title}</span>
          <span className="adm-row-sub">
            <code>{pagePath(page.slug)}</code>
          </span>
        </span>
        {page.settings && Object.keys(page.settings).length > 0 && (
          <span className="adm-tag is-page" title={`Has its own ${Object.keys(page.settings).join(", ")} (Header & layout / Background / Effects screens)`}>
            own look
          </span>
        )}
      </button>
      <button
        type="button"
        className={`adm-icon-btn adm-page-gear${settings ? " is-on" : ""}`}
        aria-label={`Settings of ${page.title}`}
        aria-pressed={settings}
        title="Page settings: title, address, links"
        onClick={() => onSettings(page.id)}
      >
        ⚙
      </button>
    </li>
  );
}

interface OutlineProps {
  map: SiteMap;
  /** Links in markdown files are still being read: warnings wait for that (useSiteMap). */
  checking?: boolean;
  /** Problems only a translation has (useSiteMap). */
  translations?: TranslationLinks[];
  /** The page the builder edits. */
  currentId: string;
  /** The page whose settings are open in the inspector. */
  settingsId: string | null;
  onOpen: (id: string) => void;
  onSettings: (id: string) => void;
  onAdd: () => void;
  onLinkFromHome: (id: string) => void;
  onShowLink: (link: PageLink) => void;
}

/**
 * The site's pages as a tree that follows their addresses (/about/colophon under /about). Pages
 * that can't be reached from the homepage by following links are marked in place and explained
 * below, with a one-click fix; links to pages that don't exist are listed after that.
 */
export function PagesOutline({ map, checking = false, translations = [], currentId, settingsId, onOpen, onSettings, onAdd, onLinkFromHome, onShowLink }: OutlineProps) {
  const row = (page: SitePage, depth: number, warn = false): ReactNode => (
    <PageRow key={page.id || "home"} page={page} depth={depth} warn={warn} current={page.id === currentId} settings={settingsId === page.id} onOpen={onOpen} onSettings={onSettings} />
  );
  // The tree follows addresses: /about/colophon sits under /about, wherever it is linked from. A
  // page whose parent address has no page sits under the nearest page above it (or the top).
  const slugs = new Set(map.pages.map((p) => p.slug));
  const holder = (slug: string) => {
    let up = parentAddress(slug);
    while (up && !slugs.has(up)) up = parentAddress(up);
    return up;
  };
  const unreachable = new Set(map.unreachable.map((p) => p.slug));
  const tree = (slug: string, depth: number): ReactNode[] =>
    map.pages
      .filter((p) => p.slug !== HOME && holder(p.slug) === slug)
      .flatMap((p) => [row(p, depth, unreachable.has(p.slug)), ...tree(p.slug, depth + 1)]);

  return (
    <>
      <div className="adm-panel-head">
        <h2>Pages</h2>
        <button type="button" className="adm-btn is-small" onClick={onAdd}>
          Add page
        </button>
      </div>
      <ul className="adm-rows adm-pages">
        {row(map.pages[0], 0)}
        {tree(HOME, 1)}
      </ul>
      {checking && map.pages.length > 1 && (
        <p className="adm-hint adm-pad adm-checking" role="status">
          Checking links…
        </p>
      )}
      {map.unreachable.length > 0 && (
        <div className="adm-pad adm-pages-warn" role="status">
          <p className="adm-notice is-warn">
            <strong>
              {map.unreachable.length === 1 ? "1 page can't" : `${map.unreachable.length} pages can't`} be reached from the homepage.
            </strong>{" "}
            Visitors only get there by typing the address (being under another page doesn&apos;t link it). Link {map.unreachable.length === 1 ? "it" : "them"} from the homepage or from a page that is
            linked.
          </p>
          <ul className="adm-unreachable-list">
            {map.unreachable.map((p) => {
              const from = map.links.filter((l) => l.to === p.slug && l.from !== p.slug);
              return (
                <li key={p.id} className="adm-unreachable">
                  <button type="button" className="adm-link adm-unreachable-name" onClick={() => onOpen(p.id)}>
                    ⚠️ {p.title} <code>{pagePath(p.slug)}</code>
                  </button>
                  <p className="adm-hint">
                    {from.length ? <>Linked only from {[...new Set(from.map((l) => pageName(map, l.from)))].join(", ")}, which can&apos;t be reached either.</> : <>No page links here.</>}{" "}
                    <button type="button" className="adm-link" onClick={() => onLinkFromHome(p.id)}>
                      Link it from Home
                    </button>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {translations.map((t) => (
        <div key={t.code} className="adm-pad adm-pages-warn" role="status">
          <p className="adm-notice is-warn">
            <strong>Only in {languageName(t.code, "en")}:</strong>{" "}
            {t.unreachable.length > 0 && (
              <>
                {t.unreachable.map((p) => p.title).join(", ")} can&apos;t be reached from the homepage. The original markdown files link there, their {languageName(t.code, "en")} versions don&apos;t.
              </>
            )}
            {t.unreachable.length > 0 && t.broken.length > 0 && " "}
            {t.broken.length > 0 && <>Links to pages that don&apos;t exist:</>}
          </p>
          {t.broken.length > 0 && (
            <ul className="adm-broken">
              {t.broken.map((l, i) => (
                <li key={i}>
                  <button type="button" className="adm-link" onClick={() => onShowLink(l)}>
                    <code>{l.href}</code> in {describeLink(map, l)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {map.broken.length > 0 && (
        <div className="adm-pad">
          <p className="adm-notice is-warn">
            <strong>Links to pages that don&apos;t exist:</strong>
          </p>
          <ul className="adm-broken">
            {map.broken.map((l, i) => (
              <li key={i}>
                <button type="button" className="adm-link" onClick={() => onShowLink(l)}>
                  <code>{l.href}</code> in {describeLink(map, l)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

interface InspectorProps {
  site: HomepageConfig;
  map: SiteMap;
  pageId: string;
  onEdit: (fn: (page: Page) => Page) => void;
  /** Changes the address; returns the markdown files that still link to the old one. */
  onAddress: (slug: string) => string[];
  onDelete: () => void;
  onLinkFromHome: () => void;
  onShowLink: (link: PageLink) => void;
}

/** Settings of one page: title, description, address, where it is linked from, delete. Render it with `key={pageId}`. */
export function PageInspector({ site, map, pageId, onEdit, onAddress, onDelete, onLinkFromHome, onShowLink }: InspectorProps) {
  const page = site.pages.find((p) => p.id === pageId);
  const slug = page?.slug ?? HOME;
  // The address is "under" (another page's address, "" = top level) + "/" + this page's own level.
  const [under, setUnder] = useState(parentAddress(slug));
  const [segment, setSegment] = useState(slug.slice(slug.lastIndexOf("/") + 1));
  const [error, setError] = useState<string | null>(null);
  const [leftover, setLeftover] = useState<string[]>([]);

  // One entry per place (a markdown file can link here more than once).
  const incoming = [...new Map(map.links.filter((l) => l.to === slug && l.from !== slug).map((l) => [`${l.from}|${l.sectionId}|${l.file ?? ""}`, l])).values()];
  const outgoing = map.links.filter((l) => l.from === slug && l.to !== slug);
  const reachable = map.reachable.has(slug);

  const links = (
    <>
      <h3 className="adm-label">Linked from</h3>
      {incoming.length ? (
        <ul className="adm-broken">
          {incoming.map((l, i) => (
            <li key={i}>
              <button type="button" className="adm-link" onClick={() => onShowLink(l)}>
                {describeLink(map, l)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-hint">{page ? "Nothing links here yet." : "The homepage is where visitors arrive."}</p>
      )}
      <h3 className="adm-label">Links to</h3>
      {outgoing.length ? (
        <ul className="adm-broken">
          {[...new Map(outgoing.map((l) => [l.to, l])).values()].map((l) => (
            <li key={l.to}>
              {pageName(map, l.to)} <code>{pagePath(l.to)}</code>
              {!map.pages.some((p) => p.slug === l.to) && <span className="adm-bad"> (no such page)</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-hint">No other pages.</p>
      )}
    </>
  );

  if (!page) {
    return (
      <>
        <div className="adm-panel-head">
          <h2>🏠 Homepage</h2>
        </div>
        <div className="adm-pad">
          <p className="adm-hint">
            The homepage is at <code>/</code>. Its name, tagline, layout and look are on the Header &amp; layout, Background and Effects screens (Whole site, or One page → Home). Every other page should be reachable from here by following links: a Links widget, a link in a
            Markdown file, a button, a project card…
          </p>
          {links}
        </div>
      </>
    );
  }

  const own = segment.trim().toLowerCase();
  const next = under ? `${under}/${own}` : own;
  // Pages under this one move along when its address changes.
  const inside = (s: string) => s === page.slug || s.startsWith(`${page.slug}/`);
  const descendants = site.pages.filter((p) => p.id !== page.id && inside(p.slug));
  // It can go under any page except itself and the pages under it, while the result stays shallow enough.
  const deepest = Math.max(0, ...descendants.map((p) => p.slug.split("/").length - page.slug.split("/").length));
  const parents = site.pages.filter((p) => !inside(p.slug) && p.slug.split("/").length + 1 + deepest <= MAX_PAGE_DEPTH);
  const changeAddress = () => {
    if (next === page.slug) return setError(null);
    if (!PAGE_SEGMENT.test(own)) return setError("Use lowercase letters, numbers and dashes, starting with a letter or number.");
    if (!PAGE_SLUG.test(next) || next.split("/").length + deepest > MAX_PAGE_DEPTH) return setError(`That goes more than ${MAX_PAGE_DEPTH} levels deep.`);
    if (isReservedSlug(next)) return setError("The site uses this address itself (anything starting with admin or api, and posts, overlay, ws).");
    // Every address that changes (this page and the ones under it) must still be free.
    const others = new Set(site.pages.filter((p) => !inside(p.slug)).map((p) => p.slug));
    const clash = [page, ...descendants].map((p) => next + p.slug.slice(page.slug.length)).find((s) => others.has(s));
    if (clash) return setError(`Another page is already at /${clash}.`);
    setError(null);
    setLeftover(onAddress(next));
  };

  return (
    <>
      <div className="adm-panel-head">
        <h2>📄 {page.title}</h2>
      </div>
      <div className="adm-pad">
        {!reachable && (
          <div className="adm-notice is-warn">
            Nobody can reach this page from the homepage.{" "}
            <button type="button" className="adm-link" onClick={onLinkFromHome}>
              Link it from Home
            </button>
          </div>
        )}
        <SchemaForm schema={formSchemas.page} value={page as unknown as Obj} onChange={(v) => onEdit((p) => ({ ...(v as unknown as Page), id: p.id, slug: p.slug, tabs: p.tabs }))} />
        <form
          className="adm-field"
          onSubmit={(e) => {
            e.preventDefault();
            changeAddress();
          }}
        >
          <span className="adm-label">Address</span>
          <label className="adm-label adm-sub" htmlFor="adm-page-under">
            Under
          </label>
          <select id="adm-page-under" className="adm-input" value={under} onChange={(e) => setUnder(e.target.value)}>
            <option value="">Nothing: a top-level page</option>
            {under && !parents.some((p) => p.slug === under) && <option value={under}>/{under} (no page there)</option>}
            {parents.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.title} ({pagePath(p.slug)})
              </option>
            ))}
          </select>
          <label className="adm-label adm-sub" htmlFor="adm-page-address">
            Its own part of the address
          </label>
          <div className="adm-inline">
            <span className="adm-muted adm-address-prefix">/{under ? `${under}/` : ""}</span>
            <input id="adm-page-address" className="adm-input" value={segment} onChange={(e) => setSegment(e.target.value)} spellCheck={false} />
            <button type="submit" className="adm-btn is-small" disabled={next === page.slug}>
              Change
            </button>
          </div>
          <span className="adm-hint">
            {next !== page.slug && own ? (
              <>
                New address: <code>{pagePath(next)}</code>.{" "}
              </>
            ) : null}
            {descendants.length > 0 && (
              <>
                {descendants.map((p) => p.title).join(", ")} {descendants.length === 1 ? "is" : "are"} under this page and move{descendants.length === 1 ? "s" : ""} along.{" "}
              </>
            )}
            Links to the old addresses in widgets are updated in the draft. The page moves when you publish.
          </span>
          {error && <span className="adm-bad">{error}</span>}
          {leftover.length > 0 && (
            <span className="adm-notice is-warn">
              Markdown files are live as you save them, so they weren&apos;t changed. After publishing, update the link in {leftover.join(", ")} on the Content screen.
            </span>
          )}
        </form>
        {links}
        <div className="adm-actions">
          <button type="button" className="adm-btn is-danger" onClick={onDelete}>
            Delete page
          </button>
        </div>
      </div>
    </>
  );
}
