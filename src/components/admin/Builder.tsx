"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimation,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HomepageConfig, Tab } from "@/lib/schema/config";
import { slugify } from "@/lib/schema/migrate";
import { widgetMetaByType, widgetMetas, type Section } from "@/widgets/meta";
import SchemaForm from "./SchemaForm";
import { formSchemas } from "./schemas";
import { api } from "./api";
import { useAdmin } from "./store";
import { RowEditor, SpanControl } from "./LayoutControls";
import { WidgetIcon } from "@/widgets/BrandIcon";
import { COLUMNS, fitRow, packRows, placeInGrid, removeFromGrid, rowIds, setRowSpans, spanOf, splitRow, type DropTarget, type PlaceResult } from "./grid-layout";
import { arrangeOf, gridOptions, ignoredTabSettings, isGridTab as isGridTabIn, pinnedTabId } from "@/lib/layouts";
import { PREVIEW_DROP, type PreviewDropState } from "./PreviewPane";
import { HOME, allIds, allSections, findPage, findPageBySlug, pageOf, pageView, pagePath, retargetLinks, sitePages, withPageTabs, type PageLink } from "@/lib/pages";
import { PAGE_DROP, PageInspector, PagesOutline } from "./PagesPanel";
import { useSiteMap } from "./useSiteMap";
import { PREVIEW_MOVE, SECTION_DRAG, pickTarget, placeInList, previewCandidates, sideFor, type Point, type PreviewHit } from "./preview-drop";

/** A row is selected through any of its widgets' ids (rows have no id of their own). */
type Selection = { kind: "tab" | "section" | "row" | "page"; id: string } | null;
type Obj = Record<string, unknown>;

// Drag ids are prefixed so one DndContext can tell tabs, sections and palette items apart.
const TAB = "tab:";
const SEC = SECTION_DRAG;
const NEW = "new:";
const LIST = "section-list";
// Grid view: each tile is also a drop target (its own id, so `sec:` still means "the dragged widget").
const CELL = "cell:";
const GRID_END = "grid-end";
/** Id of the stand-in for a palette widget while it is dragged (the real section is made on drop). */
const NEW_ITEM = "__new__";

/** Where the pointer is during a drag: the activating event's position plus the drag delta. */
function pointerOf(e: DragMoveEvent): { x: number; y: number } | null {
  const ev = e.activatorEvent as (Partial<MouseEvent> & Partial<TouchEvent>) | null;
  const touch = ev?.touches?.[0] ?? ev?.changedTouches?.[0];
  const x = touch?.clientX ?? ev?.clientX;
  const y = touch?.clientY ?? ev?.clientY;
  if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) return { x: x + e.delta.x, y: y + e.delta.y };
  // Keyboard drags have no pointer: use the middle of the dragged element.
  const r = e.active.rect.current.translated;
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

type GridHover = { target: DropTarget; result: PlaceResult<Section> };

/** A drop on the preview: the new config it gives (or why not) and the row it lands in, if a grid row. */
type PreviewPlace = { ok: true; config: HomepageConfig; row: Section[] | null } | { ok: false; reason: string };
type PreviewHover = { hit: PreviewHit; place: PreviewPlace; text: string };

const sameHover = (a: PreviewHover | null, b: PreviewHover | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.text === b.text &&
    a.hit.tabId === b.hit.tabId &&
    a.hit.id === b.hit.id &&
    a.hit.side === b.hit.side &&
    (["left", "top", "width", "height"] as const).every((k) => a.hit.box[k] === b.hit.box[k]));

/** Pixels from the preview's top or bottom edge where a drag scrolls the page. */
const SCROLL_EDGE = 56;

const PALETTE_GROUPS: [category: string, title: string][] = [
  ["content", "Text and structure"],
  ["media", "Media"],
  ["info", "Live info"],
  ["social", "Social and profiles"],
  ["gaming", "Gaming"],
  ["community", "Visitors"],
];

/** An id nobody uses yet anywhere on the site (pass the whole config, not a page view). */
function uniqueId(config: HomepageConfig, wanted: string): string {
  const used = allIds(config);
  let id = wanted;
  for (let n = 2; used.has(id); n++) id = `${wanted}-${n}`;
  return id;
}

/** A fresh widget with its defaults (`config` = the whole site, for a unique id). */
function newSection(config: HomepageConfig, tabId: string, type: string): Section {
  const meta = widgetMetaByType[type];
  return { ...structuredClone(meta.defaults), id: uniqueId(config, `${tabId}-${type}`), type } as Section;
}

/** A line of text that tells sections of the same type apart in the outline. */
function sectionSummary(section: Section): string {
  const s = section as Obj;
  const text = [s.title, s.text, s.content, s.file].find((v) => typeof v === "string" && v) as string | undefined;
  if (text) return text;
  if (Array.isArray(s.items)) return `${s.items.length} link${s.items.length === 1 ? "" : "s"}`;
  if (Array.isArray(s.repos)) return `${s.repos.length} repositor${s.repos.length === 1 ? "y" : "ies"}`;
  return "";
}

/** A drag's id with the preview's move handle (`move:<id>`) read as the widget itself (`sec:<id>`). */
const dragId = (id: string | number) => {
  const s = String(id);
  return s.startsWith(PREVIEW_MOVE) ? SEC + s.slice(PREVIEW_MOVE.length) : s;
};

/** The tab that holds section `id`. */
const tabOfSection = (config: HomepageConfig, id: string): Tab | undefined => config.tabs.find((t) => t.sections.some((s) => s.id === id));

const mapTab = (config: HomepageConfig, tabId: string, fn: (tab: Tab) => Tab): HomepageConfig => ({
  ...config,
  tabs: config.tabs.map((t) => (t.id === tabId ? fn(t) : t)),
});

// When dragging a tab only other tabs are valid targets; otherwise prefer whatever is under the pointer.
const collision: CollisionDetection = (args) => {
  const draggingTab = String(args.active.id).startsWith(TAB);
  const scoped = draggingTab ? { ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(TAB)) } : args;
  const hits = pointerWithin(scoped);
  // The preview counts only while the pointer is on it, never as the "closest" target.
  return hits.length ? hits : closestCenter({ ...scoped, droppableContainers: scoped.droppableContainers.filter((c) => c.id !== PREVIEW_DROP) });
};

function SortableRow({ id, selected, onSelect, children, label }: { id: string; selected: boolean; onSelect: () => void; children: ReactNode; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`adm-row${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${isOver && !isDragging ? " is-over" : ""}`}
      {...attributes}
      {...listeners}
      aria-label={label}
      onClick={onSelect}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onSelect();
      }}
    >
      <span className="adm-grip" aria-hidden>
        ⋮⋮
      </span>
      {children}
    </li>
  );
}

function PaletteItem({ type, onAdd, needsSetup }: { type: string; onAdd: () => void; needsSetup: boolean }) {
  const meta = widgetMetaByType[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: NEW + type });
  return (
    <button ref={setNodeRef} type="button" className={`adm-palette-item${isDragging ? " is-dragging" : ""}`} title={meta.description} onClick={onAdd} {...attributes} {...listeners}>
      <span aria-hidden>
        <WidgetIcon type={type} fallback={meta.icon} />
      </span>
      <span>{meta.label}</span>
      {needsSetup && <span className="adm-dot" title="Needs environment variables that are not set" />}
    </button>
  );
}

function SectionList({ children, empty }: { children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: LIST });
  return (
    <ul ref={setNodeRef} className={`adm-rows${isOver ? " is-over" : ""}`}>
      {children}
      {empty && <li className="adm-empty">This tab is empty. Click a widget below, or drag one here.</li>}
    </ul>
  );
}

function GridTile({
  section,
  span,
  selected,
  onSelect,
  drop,
}: {
  section: Section;
  span: number;
  selected: boolean;
  onSelect: () => void;
  drop: { side: string; bad: boolean } | null;
}) {
  const meta = widgetMetaByType[section.type];
  const drag = useDraggable({ id: SEC + section.id });
  const target = useDroppable({ id: CELL + section.id });
  // Pointer dragging only: plain droppables have no keyboard coordinates (the List view is the keyboard route).
  const { onKeyDown: _keyboardDrag, ...listeners } = drag.listeners ?? {};
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        target.setNodeRef(node);
      }}
      style={{ gridColumn: `span ${span}` }}
      className={`adm-tile${selected ? " is-selected" : ""}${drag.isDragging ? " is-dragging" : ""}${drop?.bad ? " is-bad" : ""}`}
      data-drop={drop?.side}
      {...drag.attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${meta.label} widget, ${span} of 12 columns`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="adm-row-icon" aria-hidden>
        <WidgetIcon type={section.type} fallback={meta.icon} />
      </span>
      <span className="adm-tile-label">{meta.label}</span>
      <span className="adm-tile-span">{span}/12</span>
    </div>
  );
}

function GridEnd({ active, empty }: { active: boolean; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: GRID_END });
  return (
    <div ref={setNodeRef} className={`adm-grid-end${isOver && active ? " is-over" : ""}`}>
      {empty ? "This tab is empty. Click a widget below, or drag one here." : "Drop here for a new row at the end"}
    </div>
  );
}

interface EnvStatus {
  type: string;
  env: { name: string; set: boolean }[];
}

/**
 * The stream overlay address for a widget (`/overlay/<id>`: just this widget on a transparent
 * background, for an OBS Browser Source). It shows the published version only.
 */
function OverlayLink({ id, live }: { id: string; live: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/overlay/${id}` : `${window.location.origin}/overlay/${encodeURIComponent(id)}`;
  return (
    <details className="adm-field adm-overlay">
      <summary className="adm-label">Use as a stream overlay</summary>
      {live ? (
        <>
          <div className="adm-inline">
            <input className="adm-input" readOnly value={url} aria-label="Overlay address" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="adm-btn is-small"
              onClick={() => {
                navigator.clipboard?.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span className="adm-hint">
            Add it in OBS as a Browser Source: just this widget, on a transparent background, updating live. Add <code>?theme=light</code> for light colours or{" "}
            <code>?title=0</code> to hide the title. An open overlay counts as someone watching, so Steam and Discord data keep refreshing.
          </span>
        </>
      ) : (
        <span className="adm-hint">Publish first: the overlay shows the live version of this widget.</span>
      )}
    </details>
  );
}

/** Status line while dragging in the grid: where the widget would go and the row's new widths. */
function gridStatus(hover: GridHover, sections: Section[], defaultSpan: number): string {
  const { target, result } = hover;
  if (!result.ok) return result.reason;
  if (target.id === null) return "New full-width row at the end.";
  const name = widgetMetaByType[sections.find((s) => s.id === target.id)?.type ?? ""]?.label ?? "this widget";
  if (target.side === "above" || target.side === "below") return `New full-width row ${target.side} ${name}.`;
  return `Beside ${name}: the row becomes ${result.row.map((s) => spanOf(s, defaultSpan)).join(" / ")} of 12.`;
}

/**
 * The builder's two panels (outline on the left, inspector on the right) plus the tab the
 * preview should show. Returned as pieces so the shell can keep the preview mounted between them.
 */
export function useBuilder(): {
  outline: ReactNode;
  inspector: ReactNode;
  tabSlug: string;
  /** Wraps the whole work area (outline, preview, inspector) in the drag-and-drop context. */
  dnd: (children: ReactNode) => ReactNode;
  previewDrop: PreviewDropState;
  /** The page and tab the preview should show (slugs). */
  previewTarget: { page: string; tab: string };
  /** The page the builder (and so the preview) shows; the Site/Background/Effects screens edit its own settings. */
  page: { id: string; title: string; slug: string };
  openPage: (id: string) => void;
} {
  const { config: site, published, update: updateSite } = useAdmin();
  // The builder edits one page at a time. Everything below works on `config` = that page's
  // view (its tabs as `tabs`, see lib/pages.ts) and `update` writes the tabs back, so the tab,
  // widget, grid and drop logic is the same for every page. New ids are checked against `site`.
  const [pageIdState, setPageId] = useState<string>(HOME);
  const page = findPage(site, pageIdState) ?? findPage(site, HOME)!; // a deleted page falls back to home
  const pageId = page.id;
  const config = pageView(site, pageId);
  // Synchronous on purpose: grouping typing into undo steps reads the event being handled.
  const update = (fn: (c: HomepageConfig) => HomepageConfig) => updateSite((c) => withPageTabs(c, pageId, fn(pageView(c, pageId)).tabs));
  const map = useSiteMap(site);
  const [tabId, setTabId] = useState<string | null>(config.tabs[0]?.id ?? null);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  // Grid tabs show the outline as a grid by default; the list stays available (and keyboard-sortable).
  const [listView, setListView] = useState(false);
  const [hover, setHover] = useState<GridHover | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);
  // Dropping onto the preview.
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const shownSlug = useRef("");
  const [previewHover, setPreviewHover] = useState<PreviewHover | null>(null);
  const [placing, setPlacing] = useState<PreviewDropState["placing"]>(null);
  /** The latest drag position (window coordinates) and whether it is over the preview. */
  const lastDrag = useRef<{ id: string; p: Point; overPreview: boolean } | null>(null);
  const refreshPreviewHover = useRef<() => void>(() => {});

  useEffect(() => {
    api<{ widgets: EnvStatus[] }>("integrations")
      .then((d) => setEnvStatus(d.widgets))
      .catch(() => {});
  }, []);
  const missingEnv = (type: string) => envStatus.find((w) => w.type === type)?.env.filter((e) => !e.set).map((e) => e.name) ?? [];

  const tab = config.tabs.find((t) => t.id === tabId) ?? config.tabs[0] ?? null;
  const selectedSection = selection?.kind === "section" ? tab?.sections.find((s) => s.id === selection.id) ?? null : null;
  // Widths matter where widgets can sit side by side. Which tabs that is depends on the site
  // layout (bento: all, link in bio: none, otherwise the tab's own setting): lib/layouts.ts.
  const layoutGrid = gridOptions(config.layout);
  // Profile layout: the tab shown as the column is always one widget per row.
  const pinnedId = pinnedTabId(config);
  const isGridTab = (t: Tab) => isGridTabIn(layoutGrid, t, pinnedId);
  const gridActive = !!tab && isGridTab(tab);
  const defaultSpan = layoutGrid.defaultSpan;
  const gridView = gridActive && !listView;
  /** Takes a section out of a tab; in a grid the rest of its row widens to fill it. */
  const without = (t: Tab, id: string) => (isGridTab(t) ? removeFromGrid(t.sections, id, defaultSpan) : t.sections.filter((s) => s.id !== id));

  const selectedTab = selection?.kind === "tab" ? config.tabs.find((t) => t.id === selection.id) ?? null : null;
  const tabIgnored = ignoredTabSettings(config, selectedTab?.id);

  const sensors = useSensors(
    // A small distance threshold keeps a plain click a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- edits ---

  const addTab = () => {
    const id = uniqueId(site, "new-tab");
    update((c) => ({ ...c, tabs: [...c.tabs, { id, label: "New tab", layout: "stack", sections: [] }] }));
    setTabId(id);
    setSelection({ kind: "tab", id });
  };

  const removeTab = (target: Tab) => {
    if (target.sections.length && !window.confirm(`Delete the tab "${target.label}" and its ${target.sections.length} widget${target.sections.length === 1 ? "" : "s"}?`)) return;
    update((c) => ({ ...c, tabs: c.tabs.filter((t) => t.id !== target.id) }));
    setSelection(null);
    if (tabId === target.id) setTabId(config.tabs.find((t) => t.id !== target.id)?.id ?? null);
  };

  const addSection = (type: string, toTabId: string, index?: number) => {
    const section = newSection(site, toTabId, type);
    update((c) =>
      mapTab(c, toTabId, (t) => {
        const sections = [...t.sections];
        sections.splice(index ?? sections.length, 0, section);
        return { ...t, sections };
      })
    );
    setTabId(toTabId);
    setSelection({ kind: "section", id: section.id });
  };

  /**
   * Moves a widget to the end of a tab on any page (ids are unique across the site, so the tab id
   * says which page). One undo step; a grid row it leaves closes up. Opens the target page and tab.
   */
  const moveSection = (sectionId: string, toTabId: string) => {
    const toPage = pageOf(site, toTabId);
    if (!toPage) return;
    updateSite((c) => {
      const fromPage = pageOf(c, sectionId);
      const fromTab = fromPage?.tabs.find((t) => t.sections.some((s) => s.id === sectionId));
      const section = fromTab?.sections.find((s) => s.id === sectionId);
      if (!fromPage || !fromTab || !section || fromTab.id === toTabId) return c;
      // Grid rules of the page it leaves (the profile column is always a stack).
      const fromView = pageView(c, fromPage.id); // its own layout, if it has one
      const grid = gridOptions(fromView.layout);
      const leavesGrid = isGridTabIn(grid, fromTab, pinnedTabId(fromView));
      const rest = leavesGrid ? removeFromGrid(fromTab.sections, sectionId, grid.defaultSpan) : fromTab.sections.filter((s) => s.id !== sectionId);
      const out = withPageTabs(c, fromPage.id, fromPage.tabs.map((t) => (t.id === fromTab.id ? { ...t, sections: rest } : t)));
      const target = pageOf(out, toTabId);
      if (!target) return c;
      return withPageTabs(out, target.id, target.tabs.map((t) => (t.id === toTabId ? { ...t, sections: [...t.sections, section] } : t)));
    });
    setPageId(toPage.id);
    setTabId(toTabId);
    setSelection({ kind: "section", id: sectionId });
  };

  /** A widget (or a palette item) dropped on a page in the Pages tree: to the end of that page's first tab. */
  const dropOnPage = (dragged: string, targetId: string) => {
    const target = findPage(site, targetId);
    if (!target) return;
    const view = pageView(site, targetId);
    const pinned = pinnedTabId(view);
    const first = view.tabs.find((t) => t.id !== pinned) ?? view.tabs[0];
    if (!first) return setNotice(`${target.title} has no tab yet: add one first.`);
    if (dragged.startsWith(SEC)) return moveSection(dragged.slice(SEC.length), first.id);
    const item = newSection(site, first.id, dragged.slice(NEW.length));
    updateSite((c) => withPageTabs(c, targetId, pageView(c, targetId).tabs.map((t) => (t.id === first.id ? { ...t, sections: [...t.sections, item] } : t))));
    setPageId(targetId);
    setTabId(first.id);
    setSelection({ kind: "section", id: item.id });
  };

  /**
   * Puts `item` into tab `toTabId` with `place` (given that tab's sections, returns the new list
   * or null for "no change"). If another tab holds the item, it leaves that tab in the same edit,
   * which closes the gap in its grid row. Widgets picked up in the preview can come from any tab.
   */
  const moveInto = (c: HomepageConfig, item: Section, toTabId: string, place: (sections: Section[]) => Section[] | null): HomepageConfig => {
    const target = c.tabs.find((t) => t.id === toTabId);
    const sections = target ? place(target.sections) : null;
    if (!sections) return c;
    const from = c.tabs.find((t) => t.id !== toTabId && t.sections.some((s) => s.id === item.id));
    return { ...c, tabs: c.tabs.map((t) => (t.id === toTabId ? { ...t, sections } : t.id === from?.id ? { ...t, sections: without(t, item.id) } : t)) };
  };

  /** The section being dragged (from any tab: the preview's handle can pick up any visible one), a stand-in for a palette widget, or null for tabs. */
  const draggedItem = (a: string): Section | null => {
    if (a.startsWith(SEC)) return tabOfSection(config, a.slice(SEC.length))?.sections.find((s) => SEC + s.id === a) ?? null;
    if (a.startsWith(NEW)) return { id: NEW_ITEM, type: a.slice(NEW.length) } as Section;
    return null;
  };

  // --- dropping onto the preview ---

  /**
   * Puts `item` where a drop on the preview points: beside / above / below a widget of any tab
   * the preview shows (one page shows them all, the profile layout a column tab too). Grid tabs
   * use the same row logic as the outline; one-per-row tabs just take the position. An item
   * from another tab leaves that tab in the same edit (one undo step).
   */
  const placeFromPreview = (c: HomepageConfig, item: Section, hit: PreviewHit): PreviewPlace => {
    const target = c.tabs.find((t) => t.id === hit.tabId);
    if (!target) return { ok: false, reason: "The preview is still catching up. Try again in a moment." };
    if (isGridTab(target)) {
      // A phone-width or narrow preview shows the grid as one column; "beside" is not offered
      // there (previewCandidates), so it is above / below = a new full-width row.
      const r = placeInGrid(target.sections, item, hit.id === null ? { id: null, side: "end" } : { id: hit.id, side: hit.side }, defaultSpan);
      if (!r.ok) return r;
      return { ok: true, row: r.row, config: moveInto(c, item, target.id, () => r.items) };
    }
    return { ok: true, row: null, config: moveInto(c, item, target.id, (sections) => placeInList(sections, item, hit.id, hit.side)) };
  };

  /** The line shown next to the pointer while hovering the preview. */
  const previewText = (hit: PreviewHit, place: PreviewPlace): string => {
    if (!place.ok) return place.reason;
    const target = config.tabs.find((t) => t.id === hit.tabId);
    const tabName = target?.label || "this tab";
    if (hit.id === null) return `At the end of ${tabName}.`;
    const there = target && target.id !== tab?.id ? ` in ${tabName}` : "";
    const name = widgetMetaByType[target?.sections.find((s) => s.id === hit.id)?.type ?? ""]?.label ?? "this widget";
    if ((hit.side === "left" || hit.side === "right") && place.row) return `Beside ${name}: the row becomes ${place.row.map((s) => spanOf(s, defaultSpan)).join(" / ")} of 12.`;
    if (target && isGridTab(target)) return `New full-width row ${hit.side} ${name}${there}.`;
    return `${hit.side === "above" ? "Above" : "Below"} ${name}${there}.`;
  };

  /** Hit-tests the preview page at a window position (the iframe is same-origin). */
  const previewHoverAt = (activeId: string, p: Point): PreviewHover | null => {
    const item = draggedItem(activeId);
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!item || !frame || !doc) return null;
    const r = frame.getBoundingClientRect();
    if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) return null;
    // Into the page's own viewport coordinates (inside the iframe's border).
    const hit = pickTarget({ x: p.x - r.left - frame.clientLeft, y: p.y - r.top - frame.clientTop }, previewCandidates(doc));
    if (!hit || hit.id === item.id) return null;
    const place = placeFromPreview(config, item, hit);
    return { hit, place, text: previewText(hit, place) };
  };

  // Scrolling the preview mid-drag (wheel, edge scroll) moves the widgets under a still pointer.
  useEffect(() => {
    refreshPreviewHover.current = () => {
      const d = lastDrag.current;
      if (!d?.overPreview) return;
      const next = previewHoverAt(d.id, d.p);
      setPreviewHover((prev) => (sameHover(prev, next) ? prev : next));
    };
  });

  // While a widget is dragged: follow the preview's scrolling, and scroll it when the pointer
  // rests near its top or bottom edge (the page may be much taller than the panel).
  const draggingWidget = !!dragging && !dragging.startsWith(TAB);
  useEffect(() => {
    if (!draggingWidget) return;
    const win = frameRef.current?.contentWindow;
    const onScroll = () => refreshPreviewHover.current();
    win?.addEventListener("scroll", onScroll, { passive: true });
    // The wheel goes to whatever is under the pointer, which mid-drag is the drag overlay
    // following it, not the preview: pass it on to the page while over the preview.
    const onWheel = (e: WheelEvent) => {
      if (lastDrag.current?.overPreview) frameRef.current?.contentWindow?.scrollBy(e.deltaX, e.deltaY);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    let raf = 0;
    const tick = () => {
      const d = lastDrag.current;
      const f = frameRef.current;
      if (d?.overPreview && f) {
        const r = f.getBoundingClientRect();
        const up = r.top + SCROLL_EDGE - d.p.y;
        const down = d.p.y - (r.bottom - SCROLL_EDGE);
        if (d.p.x >= r.left && d.p.x <= r.right) {
          if (up > 0 && up <= SCROLL_EDGE) f.contentWindow?.scrollBy(0, -Math.ceil(up / 3));
          else if (down > 0 && down <= SCROLL_EDGE) f.contentWindow?.scrollBy(0, Math.ceil(down / 3));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      win?.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
    };
  }, [draggingWidget]);

  // Grid view: work out the drop position and its result while dragging, so the outline can show
  // where the widget would land, or that there is no room, before it is dropped.
  const onDragMove = (e: DragMoveEvent) => {
    const activeId = dragId(e.active.id);
    const pointer = pointerOf(e);
    const overPreview = e.over?.id === PREVIEW_DROP;
    lastDrag.current = pointer ? { id: activeId, p: pointer, overPreview } : null;
    if (overPreview) {
      const next = pointer ? previewHoverAt(activeId, pointer) : null;
      setPreviewHover((prev) => (sameHover(prev, next) ? prev : next));
      if (hover) setHover(null);
      return;
    }
    if (previewHover) setPreviewHover(null);
    if (!gridView || !tab) return;
    const item = draggedItem(activeId);
    const o = e.over ? String(e.over.id) : "";
    const p = pointer;
    let target: DropTarget | null = null;
    if (item && o === GRID_END) target = { id: null, side: "end" };
    else if (item && o.startsWith(CELL) && p && e.over) target = { id: o.slice(CELL.length), side: sideFor(p, e.over.rect, true) };
    if (!target || target.id === item?.id) {
      if (hover) setHover(null);
      return;
    }
    if (hover && hover.target.id === target.id && hover.target.side === target.side) return;
    setHover({ target, result: placeInGrid(tab.sections, item!, target, defaultSpan) });
  };

  const endDrag = () => {
    setDragging(null);
    setHover(null);
    setPreviewHover(null);
    lastDrag.current = null;
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const gridDrop = hover;
    const previewDropped = previewHover;
    endDrag();
    if (!over || !tab) return;
    const a = dragId(active.id);
    const o = String(over.id);
    if (a === o) return;

    if (o === PREVIEW_DROP) {
      if (!previewDropped) return;
      const { hit, place } = previewDropped;
      if (!place.ok) {
        if (place.reason) setNotice(`${place.reason} The widget went back to where it was.`);
        return;
      }
      const target = config.tabs.find((t) => t.id === hit.tabId);
      const item = !target ? null : a.startsWith(NEW) ? newSection(site, target.id, a.slice(NEW.length)) : draggedItem(a);
      if (!target || !item) return;
      update((c) => {
        const r = placeFromPreview(c, item, hit);
        return r.ok ? r.config : c;
      });
      // The preview already shows that tab; sending it there again would scroll the one-page layout away.
      if (target.id !== pinnedId) shownSlug.current = `${page.slug}|${slugify(target.label)}`;
      setTabId(target.id);
      setSelection({ kind: "section", id: item.id });
      setPlacing({ box: hit.box, side: hit.side, label: a.startsWith(NEW) ? "Adding…" : "Moving…" });
      return;
    }

    if (gridView && gridDrop && (o.startsWith(CELL) || o === GRID_END)) {
      if (!gridDrop.result.ok) {
        if (gridDrop.result.reason) setNotice(`${gridDrop.result.reason} The widget went back to where it was.`);
        return;
      }
      // The result was worked out against this config; recompute inside the (pure) updater anyway.
      const item = a.startsWith(NEW) ? newSection(site, tab.id, a.slice(NEW.length)) : draggedItem(a);
      if (!item) return;
      update((c) =>
        moveInto(c, item, tab.id, (sections) => {
          const r = placeInGrid(sections, item, gridDrop.target, defaultSpan);
          return r.ok ? r.items : null;
        })
      );
      setSelection({ kind: "section", id: item.id });
      return;
    }

    if (o.startsWith(PAGE_DROP)) {
      if (a.startsWith(SEC) || a.startsWith(NEW)) dropOnPage(a, o.slice(PAGE_DROP.length));
      return;
    }

    if (a.startsWith(TAB) && o.startsWith(TAB)) {
      update((c) => {
        const from = c.tabs.findIndex((t) => TAB + t.id === a);
        const to = c.tabs.findIndex((t) => TAB + t.id === o);
        return from < 0 || to < 0 ? c : { ...c, tabs: arrayMove(c.tabs, from, to) };
      });
    } else if (a.startsWith(SEC)) {
      const id = a.slice(SEC.length);
      const fromTab = tabOfSection(config, id);
      if (!fromTab) return;
      if (o.startsWith(SEC) && fromTab.id === tab.id) {
        update((c) =>
          mapTab(c, tab.id, (t) => {
            const from = t.sections.findIndex((s) => SEC + s.id === a);
            const to = t.sections.findIndex((s) => SEC + s.id === o);
            return from < 0 || to < 0 ? t : { ...t, sections: arrayMove(t.sections, from, to) };
          })
        );
      } else if (o.startsWith(SEC)) {
        // Picked up in the preview from another tab, dropped on a row of the open tab's list.
        const item = draggedItem(a);
        if (!item) return;
        update((c) => moveInto(c, item, tab.id, (sections) => placeInList(sections, item, o.slice(SEC.length), "above")));
        setSelection({ kind: "section", id });
      } else if (o.startsWith(TAB)) {
        moveSection(id, o.slice(TAB.length));
      } else if (o === LIST) {
        moveSection(id, tab.id);
      }
    } else if (a.startsWith(NEW)) {
      const type = a.slice(NEW.length);
      if (o.startsWith(SEC)) addSection(type, tab.id, tab.sections.findIndex((s) => SEC + s.id === o));
      else if (o.startsWith(TAB)) addSection(type, o.slice(TAB.length));
      else if (o === LIST) addSection(type, tab.id);
    }
  };

  const overlayLabel = (() => {
    if (!dragging) return null;
    const widget = (type: string) => ({ icon: <WidgetIcon type={type} fallback={widgetMetaByType[type].icon} />, label: widgetMetaByType[type].label });
    if (dragging.startsWith(NEW)) return widget(dragging.slice(NEW.length));
    if (dragging.startsWith(SEC)) {
      const s = draggedItem(dragging);
      return s ? widget(s.type) : null;
    }
    const t = config.tabs.find((x) => TAB + x.id === dragging);
    return t ? { icon: t.icon ?? "", label: t.label } : null;
  })();

  // --- pages ---

  /** Opens a page in the builder; the preview follows. `settings` also shows its settings. */
  const openPage = (id: string, settings = false) => {
    if (id !== pageId) {
      setPageId(id);
      setTabId(pageView(site, id).tabs[0]?.id ?? null);
    }
    setSelection(settings ? { kind: "page", id } : null);
  };

  const addPage = () => {
    const taken = new Set(site.pages.map((p) => p.slug));
    let slug = "new-page";
    for (let n = 2; taken.has(slug); n++) slug = `new-page-${n}`;
    const id = uniqueId(site, `page-${slug}`);
    const firstTab = uniqueId(site, `${slug}-main`);
    // A title nobody else has, so warnings and the site map can tell new pages apart.
    const titles = new Set(site.pages.map((p) => p.title));
    let title = "New page";
    for (let n = 2; titles.has(title); n++) title = `New page ${n}`;
    updateSite((c) => ({ ...c, pages: [...c.pages, { id, slug, title, tabs: [{ id: firstTab, label: "Main", layout: "stack", sections: [] }] }] }));
    setPageId(id);
    setTabId(firstTab);
    setSelection({ kind: "page", id });
  };

  const deletePage = (id: string) => {
    const target = site.pages.find((p) => p.id === id);
    if (!target) return;
    const widgets = target.tabs.reduce((n, t) => n + t.sections.length, 0);
    if (!window.confirm(`Delete the page "${target.title}" (${pagePath(target.slug)})${widgets ? ` and its ${widgets} widget${widgets === 1 ? "" : "s"}` : ""}? Links to it will point nowhere.`)) return;
    updateSite((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== id) }));
    openPage(HOME);
  };

  const editPage = (id: string, fn: (p: HomepageConfig["pages"][number]) => HomepageConfig["pages"][number]) =>
    updateSite((c) => ({ ...c, pages: c.pages.map((p) => (p.id === id ? fn(p) : p)) }));

  /** New address: links in widgets follow (draft); returns the markdown files that still link to the old one. */
  const changeAddress = (id: string, slug: string): string[] => {
    const old = site.pages.find((p) => p.id === id)?.slug;
    if (old === undefined) return [];
    const host = window.location.host.toLowerCase();
    updateSite((c) => retargetLinks({ ...c, pages: c.pages.map((p) => (p.id === id ? { ...p, slug } : p)) }, old, slug, [host]));
    return [...new Set(map.links.filter((l) => l.to === old && l.file).map((l) => l.file!))];
  };

  /**
   * The one-click fix for a page nobody can reach: a link to it on the homepage's first tab, in
   * the Links widget there (or a new one). Opens it so the link can be moved or restyled.
   */
  const linkFromHome = (id: string) => {
    const target = site.pages.find((p) => p.id === id);
    if (!target) return;
    const item = { label: target.title, url: pagePath(target.slug) };
    const home = site.tabs[0];
    const existing = home?.sections.find((x) => x.type === "links");
    let homeTab = home?.id;
    let selectId: string;
    if (!home) {
      homeTab = uniqueId(site, "main");
      selectId = uniqueId(site, "main-links");
      updateSite((c) => ({ ...c, tabs: [{ id: homeTab!, label: "Main", layout: "stack", sections: [{ id: selectId, type: "links", items: [item] } as Section] }] }));
    } else if (existing) {
      selectId = existing.id;
      updateSite((c) =>
        withPageTabs(
          c,
          HOME,
          c.tabs.map((t) => (t.id === home.id ? { ...t, sections: t.sections.map((x) => (x.id === existing.id ? ({ ...x, items: [...(x as { items: unknown[] }).items, item] } as Section) : x)) } : t))
        )
      );
    } else {
      selectId = uniqueId(site, `${home.id}-links`);
      updateSite((c) => withPageTabs(c, HOME, c.tabs.map((t) => (t.id === home.id ? { ...t, sections: [...t.sections, { id: selectId, type: "links", items: [item] } as Section] } : t))));
    }
    setPageId(HOME);
    setTabId(homeTab ?? null);
    setSelection({ kind: "section", id: selectId });
  };

  /** Opens the page and widget a link is in. */
  const showLink = (link: PageLink) => {
    const from = findPageBySlug(site, link.from) ?? pageOf(site, link.sectionId);
    if (!from) return;
    setPageId(from.id);
    setTabId(link.tabId);
    setSelection({ kind: "section", id: link.sectionId });
  };

  // --- outline ---

  const outline = (
    <>
      <PagesOutline
        map={map}
        currentId={pageId}
        settingsId={selection?.kind === "page" ? selection.id : null}
        onOpen={(id) => openPage(id)}
        onSettings={(id) => openPage(id, true)}
        onAdd={addPage}
        onLinkFromHome={linkFromHome}
        onShowLink={showLink}
      />
      <div className="adm-panel-head">
        <h2>{site.pages.length ? `Tabs on ${page.title}` : "Tabs"}</h2>
        <button type="button" className="adm-btn is-small" onClick={addTab}>
          Add tab
        </button>
      </div>
      <SortableContext items={config.tabs.map((t) => TAB + t.id)} strategy={verticalListSortingStrategy}>
        <ul className="adm-rows">
          {config.tabs.map((t) => (
            <SortableRow
              key={t.id}
              id={TAB + t.id}
              label={`Tab ${t.label}`}
              selected={t.id === tab?.id}
              onSelect={() => {
                setTabId(t.id);
                setSelection({ kind: "tab", id: t.id });
              }}
            >
              <span className="adm-row-icon" aria-hidden>
                {t.icon && !/^https?:/.test(t.icon) ? t.icon : "▫"}
              </span>
              <span className="adm-row-text">
                <span className="adm-row-title">{t.label || "Untitled"}</span>
              </span>
              {t.id === pinnedId && (
                <span className="adm-badge" title="Shown as the column beside the other tabs (Header & layout → Layout)">
                  column
                </span>
              )}
              <span className="adm-count">{t.sections.length}</span>
            </SortableRow>
          ))}
          {!config.tabs.length && <li className="adm-empty">No tabs yet. Add one to start building.</li>}
        </ul>
      </SortableContext>

      {tab && (
        <>
          <div className="adm-panel-head">
            <h2>Widgets in {tab.label || "this tab"}</h2>
            {gridActive && (
              <div className="adm-seg is-small" role="group" aria-label="Outline view">
                <button type="button" aria-pressed={!listView} onClick={() => setListView(false)}>
                  Grid
                </button>
                <button type="button" aria-pressed={listView} onClick={() => setListView(true)} title="A list you can also reorder with the keyboard">
                  List
                </button>
              </div>
            )}
          </div>
          {gridView ? (
            <div className="adm-pad-x">
              {/* One grid per row, packed by packRows (the same wrapping the site's CSS grid does),
                  so each row can have a handle that selects it for the row editor. */}
              <div className="adm-grid-rows">
                {packRows(tab.sections, defaultSpan).map((row) => {
                  const members = row.map((i) => tab.sections[i]);
                  const rowSelected = selection?.kind === "row" && members.some((m) => m.id === selection.id);
                  return (
                    <div key={members[0].id} className={`adm-grid-row${rowSelected ? " is-selected" : ""}`}>
                      {members.length > 1 ? (
                        <button
                          type="button"
                          className="adm-row-handle"
                          aria-pressed={rowSelected}
                          aria-label={`Row: ${members.map((m) => widgetMetaByType[m.type].label).join(", ")}`}
                          title="Select this row to set its widths together"
                          onClick={() => setSelection({ kind: "row", id: members[0].id })}
                        />
                      ) : (
                        <span className="adm-row-handle is-empty" aria-hidden />
                      )}
                      <div className="adm-grid-outline">
                        {members.map((s) => {
                          const hit = hover && hover.target.id === s.id ? hover : null;
                          return (
                            <GridTile
                              key={s.id}
                              section={s}
                              span={spanOf(s, defaultSpan)}
                              selected={(selection?.kind === "section" && selection.id === s.id) || rowSelected}
                              onSelect={() => setSelection({ kind: "section", id: s.id })}
                              drop={hit ? { side: hit.target.side, bad: !hit.result.ok } : null}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <GridEnd active={!!dragging} empty={!tab.sections.length} />
              <p className="adm-hint adm-grid-help">Drag a widget onto another one&apos;s side to share its row, onto its top or bottom for a new row. Widths adjust by themselves.</p>
            </div>
          ) : (
          <SortableContext items={tab.sections.map((s) => SEC + s.id)} strategy={verticalListSortingStrategy}>
            <SectionList empty={!tab.sections.length}>
              {tab.sections.map((s) => {
                const meta = widgetMetaByType[s.type];
                const summary = sectionSummary(s);
                return (
                  <SortableRow key={s.id} id={SEC + s.id} label={`${meta.label} widget`} selected={selection?.kind === "section" && selection.id === s.id} onSelect={() => setSelection({ kind: "section", id: s.id })}>
                    <span className="adm-row-icon" aria-hidden>
                      <WidgetIcon type={s.type} fallback={meta.icon} />
                    </span>
                    <span className="adm-row-text">
                      <span className="adm-row-title">{meta.label}</span>
                      {summary && <span className="adm-row-sub">{summary}</span>}
                    </span>
                    {gridActive && (
                      <span className="adm-count" title="Width in grid columns">
                        {s.span ?? defaultSpan}/12
                      </span>
                    )}
                  </SortableRow>
                );
              })}
            </SectionList>
          </SortableContext>
          )}

          <div className="adm-panel-head">
            <h2>Add a widget</h2>
          </div>
          <p className="adm-hint adm-pad">
            {gridView ? "Click to add at the end, or drag beside a widget, above or below it, or onto another tab." : "Click to add at the end, or drag into the list or onto another tab."}
          </p>
          {PALETTE_GROUPS.map(([category, title]) => (
            <div key={category}>
              <h3 className="adm-palette-title">{title}</h3>
              <div className="adm-palette">
                {widgetMetas
                  .filter((m) => m.category === category)
                  .map((m) => (
                    <PaletteItem key={m.type} type={m.type} needsSetup={missingEnv(m.type).length > 0} onAdd={() => addSection(m.type, tab.id)} />
                  ))}
              </div>
            </div>
          ))}
        </>
      )}

    </>
  );

  const refused = (hover && !hover.result.ok) || (previewHover && !previewHover.place.ok);
  const dragHint = previewHover ? { text: previewHover.text, ok: previewHover.place.ok } : gridView && hover && tab ? { text: gridStatus(hover, tab.sections, defaultSpan), ok: hover.result.ok } : null;
  const dnd = (children: ReactNode) => (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => {
        setDragging(dragId(e.active.id));
        setNotice(null);
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      {children}
      {/* Fixed, not in the flow: a message that appears or goes mid-drag would move the tiles under the pointer. */}
      {notice && (
        <p className="adm-notice is-bad adm-grid-notice" role="status">
          {notice}
        </p>
      )}
      {/* A refused grid drop animates back to where the widget came from; anything else lands instantly. */}
      <DragOverlay className="adm-drag-overlay" dropAnimation={refused ? defaultDropAnimation : null}>
        {overlayLabel && (
          <div className="adm-row is-overlay">
            <span className="adm-row-icon" aria-hidden>
              {overlayLabel.icon}
            </span>
            <span className="adm-row-text">
              <span className="adm-row-title">{overlayLabel.label}</span>
              {/* Grid view or preview: where it would land (or why it can't), right next to the pointer. */}
              {dragHint && (
                <span className={`adm-overlay-hint${dragHint.ok ? "" : " is-bad"}`} aria-live="polite">
                  {dragHint.text}
                </span>
              )}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );

  // --- inspector ---

  let inspector: ReactNode = (
    <div className="adm-empty adm-pad">
      Select a tab or a widget to change its settings. Drag rows to reorder them; drag a widget onto a tab to move it there.
    </div>
  );

  /** The row editor for the row made of `ids` (all widths edited together, always adding up to 12). */
  const rowEditor = (ids: string[], current?: string) => {
    if (!tab) return null;
    const members = ids.map((id) => tab.sections.find((x) => x.id === id)!);
    const raw = members.map((m) => spanOf(m, defaultSpan));
    // A hand-made row may not fill all 12 columns; the editor starts from it scaled to 12.
    const fills = raw.reduce((a, b) => a + b, 0) === COLUMNS;
    return (
      <>
        <RowEditor
          members={members.map((m) => ({ id: m.id, label: widgetMetaByType[m.type].label, icon: <WidgetIcon type={m.type} fallback={widgetMetaByType[m.type].icon} size={14} /> }))}
          spans={fills ? raw : fitRow(raw)}
          current={current}
          onCommit={(spans) => update((c) => mapTab(c, tab.id, (t) => ({ ...t, sections: setRowSpans(t.sections, rowIds(t.sections, ids[0], defaultSpan), spans, defaultSpan) })))}
          onSplit={() => update((c) => mapTab(c, tab.id, (t) => ({ ...t, sections: splitRow(t.sections, ids, defaultSpan) })))}
          onSelect={(id) => setSelection({ kind: "section", id })}
        />
        {!fills && <p className="adm-hint">This row doesn&apos;t fill all 12 columns yet; any change here makes it fill them.</p>}
      </>
    );
  };
  const selectedRow = selection?.kind === "row" && tab && gridActive ? rowIds(tab.sections, selection.id, defaultSpan) : [];

  if (selection?.kind === "page") {
    inspector = (
      <PageInspector
        key={selection.id}
        site={site}
        map={map}
        pageId={selection.id}
        onEdit={(fn) => editPage(selection.id, fn)}
        onAddress={(slug) => changeAddress(selection.id, slug)}
        onDelete={() => deletePage(selection.id)}
        onLinkFromHome={() => linkFromHome(selection.id)}
        onShowLink={showLink}
      />
    );
  } else if (selectedRow.length) {
    inspector = (
      <>
        <div className="adm-panel-head">
          <h2>Row</h2>
        </div>
        <div className="adm-pad">
          <p className="adm-hint">
            {selectedRow.length} widgets side by side. Their widths are set together here, so the row always fills the page width and the rows below stay as they are.
          </p>
          {rowEditor(selectedRow)}
        </div>
      </>
    );
  } else if (selectedTab) {
    inspector = (
      <>
        <div className="adm-panel-head">
          <h2>Tab settings</h2>
        </div>
        <div className="adm-pad">
          <SchemaForm
            schema={formSchemas.tab}
            value={selectedTab as unknown as Obj}
            // Settings the site layout ignores are hidden (their values stay) and explained below.
            hide={tabIgnored.flatMap((x) => (x.key ? [x.key] : []))}
            onChange={(v) => update((c) => mapTab(c, selectedTab.id, (t) => ({ ...(v as unknown as Tab), sections: t.sections })))}
          />
          {tabIgnored.map((x) => (
            <p key={x.note} className="adm-hint adm-layout-note">
              {x.note}
            </p>
          ))}
          <div className="adm-actions">
            <button type="button" className="adm-btn is-danger" onClick={() => removeTab(selectedTab)}>
              Delete tab
            </button>
          </div>
        </div>
      </>
    );
  } else if (selectedSection && tab) {
    const meta = widgetMetaByType[selectedSection.type];
    const missing = missingEnv(selectedSection.type);
    const remove = () => {
      update((c) => mapTab(c, tab.id, (t) => ({ ...t, sections: without(t, selectedSection.id) })));
      setSelection(null);
    };
    const duplicate = () => {
      const copy = { ...structuredClone(selectedSection), id: uniqueId(site, `${tab.id}-${selectedSection.type}`) } as Section;
      update((c) =>
        mapTab(c, tab.id, (t) => {
          // In a grid: beside the original if its row has room, otherwise on a new row below it.
          if (isGridTab(t)) {
            const beside = placeInGrid(t.sections, copy, { id: selectedSection.id, side: "right" }, defaultSpan);
            const placed = beside.ok ? beside : placeInGrid(t.sections, copy, { id: selectedSection.id, side: "below" }, defaultSpan);
            if (placed.ok) return { ...t, sections: placed.items };
          }
          const sections = [...t.sections];
          sections.splice(sections.findIndex((s) => s.id === selectedSection.id) + 1, 0, copy);
          return { ...t, sections };
        })
      );
      setSelection({ kind: "section", id: copy.id });
    };
    inspector = (
      <>
        <div className="adm-panel-head">
          <h2>
            <span aria-hidden>
              <WidgetIcon type={selectedSection.type} fallback={meta.icon} size={20} />
            </span>{" "}
            {meta.label}
          </h2>
        </div>
        <div className="adm-pad">
          <p className="adm-hint">{meta.description}</p>
          {missing.length > 0 && (
            <p className="adm-notice is-warn">
              This widget stays empty until {missing.join(" and ")} {missing.length === 1 ? "is" : "are"} set in the server environment.
            </p>
          )}
          <SchemaForm
            schema={formSchemas.widgets[selectedSection.type]}
            value={selectedSection as unknown as Obj}
            onChange={(v) => update((c) => mapTab(c, tab.id, (t) => ({ ...t, sections: t.sections.map((s) => (s.id === selectedSection.id ? (v as unknown as Section) : s)) })))}
          />
          {!gridActive && (
            <p className="adm-hint adm-span-hint">
              {tab.id === pinnedId ? (
                <>This tab is the column beside the other tabs, so its widgets are always full width.</>
              ) : arrangeOf(layoutGrid, tab) === "masonry" ? (
                <>In the Masonry layout every widget is one column wide and as tall as it needs; widgets flow top to bottom, column by column.</>
              ) : layoutGrid.arrange === "stack" ? (
                <>The Link in bio layout shows every widget at full width, so there is no width to set here.</>
              ) : (
                <>
                  Widths apply where widgets can sit side by side. To set this widget&apos;s width, select the tab &ldquo;{tab.label}&rdquo; and set{" "}
                  <strong>Arrange widgets</strong> to <strong>Grid</strong> (or pick the Bento layout on Header & layout).
                </>
              )}
            </p>
          )}
          {gridActive && rowIds(tab.sections, selectedSection.id, defaultSpan).length > 1 && rowEditor(rowIds(tab.sections, selectedSection.id, defaultSpan), selectedSection.id)}
          {gridActive && rowIds(tab.sections, selectedSection.id, defaultSpan).length <= 1 && (
            <SpanControl
              value={selectedSection.span}
              defaultSpan={defaultSpan}
              onChange={(span) =>
                update((c) =>
                  mapTab(c, tab.id, (t) => ({
                    ...t,
                    sections: t.sections.map((s) => {
                      if (s.id !== selectedSection.id) return s;
                      const { span: _old, ...rest } = s;
                      return (span === undefined ? rest : { ...s, span }) as Section;
                    }),
                  }))
                )
              }
            />
          )}
          <OverlayLink id={selectedSection.id} live={allSections(published).some((x) => x.id === selectedSection.id)} />
          {sitePages(site).reduce((n, p) => n + p.tabs.length, 0) > 1 && (
            <label className="adm-field">
              <span className="adm-label">{site.pages.length ? "Move to page / tab" : "Move to tab"}</span>
              <select className="adm-input" value={tab.id} onChange={(e) => moveSection(selectedSection.id, e.target.value)}>
                {site.pages.length
                  ? sitePages(site).map((p) => (
                      <optgroup key={p.id || "home"} label={`${p.title} (${pagePath(p.slug)})`}>
                        {p.tabs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : config.tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
              </select>
              {site.pages.length > 0 && <span className="adm-hint">Or drag the widget onto a page in the Pages list.</span>}
            </label>
          )}
          <div className="adm-actions">
            <button type="button" className="adm-btn" onClick={duplicate}>
              Duplicate
            </button>
            <button type="button" className="adm-btn is-danger" onClick={remove}>
              Delete widget
            </button>
          </div>
        </div>
      </>
    );
  }

  // The column tab isn't in the site's tab bar, so the preview stays on the tab it shows.
  return {
    outline,
    inspector,
    dnd,
    tabSlug: tab && tab.id !== pinnedId ? slugify(tab.label) : "",
    previewTarget: { page: page.slug, tab: tab && tab.id !== pinnedId ? slugify(tab.label) : "" },
    page: { id: page.id, title: page.title, slug: page.slug },
    openPage: (id: string) => openPage(id),
    previewDrop: {
      onSelect: (id: string) => {
        const t = tabOfSection(config, id);
        if (!t) return;
        // The preview already shows it (see shownSlug); the one-page preview must not jump.
        if (t.id !== pinnedId) shownSlug.current = `${page.slug}|${slugify(t.label)}`;
        setTabId(t.id);
        setSelection({ kind: "section", id });
      },
      selectedId: selection?.kind === "section" ? selection.id : null,
      onTabShown: ({ page: shownPage, tab: slug }) => {
        // The preview shows it already: record that, so opening it here sends nothing back.
        shownSlug.current = `${shownPage}|${slug}`;
        // Mid-drag (one page scrolling under an edge auto-scroll) the outline must stay put.
        if (dragging) return;
        const other = findPageBySlug(site, shownPage);
        if (!other) return;
        const view = pageView(site, other.id);
        const pinned = pinnedTabId(view);
        const t = (slug ? view.tabs.find((x) => x.id !== pinned && slugify(x.label) === slug) : undefined) ?? (other.id !== pageId ? view.tabs.find((x) => x.id !== pinned) : undefined);
        if (other.id !== pageId) {
          // A link to another page was followed in the preview: edit that page.
          setPageId(other.id);
          setTabId(t?.id ?? null);
          setSelection(null);
          return;
        }
        if (!t || t.id === tab?.id) return;
        setTabId(t.id);
        // Keep the selection only if it still belongs to the open tab.
        setSelection((sel) => (sel && (sel.kind === "tab" ? sel.id === t.id : t.sections.some((s) => s.id === sel.id)) ? sel : null));
      },
      frameRef,
      shownSlug,
      active: draggingWidget,
      marker: previewHover ? { box: previewHover.hit.box, side: previewHover.hit.side, bad: !previewHover.place.ok } : null,
      placing,
    },
  };
}
