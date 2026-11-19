"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { gridOptions, ignoredTabSettings, isGridTab as isGridTabIn } from "@/lib/layouts";

/** A row is selected through any of its widgets' ids (rows have no id of their own). */
type Selection = { kind: "tab" | "section" | "row"; id: string } | null;
type Obj = Record<string, unknown>;

// Drag ids are prefixed so one DndContext can tell tabs, sections and palette items apart.
const TAB = "tab:";
const SEC = "sec:";
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

/** Which side of a tile the pointer is on: outer 30% left/right = beside, otherwise top/bottom half = new row. */
function sideOf(p: { x: number; y: number }, r: { left: number; top: number; width: number; height: number }): "left" | "right" | "above" | "below" {
  const rx = (p.x - r.left) / (r.width || 1);
  if (rx < 0.3) return "left";
  if (rx > 0.7) return "right";
  return p.y - r.top < r.height / 2 ? "above" : "below";
}

type GridHover = { target: DropTarget; result: PlaceResult<Section> };

const PALETTE_GROUPS: [category: string, title: string][] = [
  ["content", "Text and structure"],
  ["media", "Media"],
  ["info", "Live info"],
  ["social", "Social and profiles"],
  ["gaming", "Gaming"],
  ["community", "Visitors"],
];

function uniqueId(config: HomepageConfig, wanted: string): string {
  const used = new Set(config.tabs.flatMap((t) => [t.id, ...t.sections.map((s) => s.id)]));
  let id = wanted;
  for (let n = 2; used.has(id); n++) id = `${wanted}-${n}`;
  return id;
}

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

const mapTab = (config: HomepageConfig, tabId: string, fn: (tab: Tab) => Tab): HomepageConfig => ({
  ...config,
  tabs: config.tabs.map((t) => (t.id === tabId ? fn(t) : t)),
});

// When dragging a tab only other tabs are valid targets; otherwise prefer whatever is under the pointer.
const collision: CollisionDetection = (args) => {
  const draggingTab = String(args.active.id).startsWith(TAB);
  const scoped = draggingTab ? { ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(TAB)) } : args;
  const hits = pointerWithin(scoped);
  return hits.length ? hits : closestCenter(scoped);
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
export function useBuilder(): { outline: ReactNode; inspector: ReactNode; tabSlug: string } {
  const { config, update } = useAdmin();
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
  const isGridTab = (t: Tab) => isGridTabIn(layoutGrid, t);
  const gridActive = !!tab && isGridTab(tab);
  const defaultSpan = layoutGrid.defaultSpan;
  const gridView = gridActive && !listView;
  /** Takes a section out of a tab; in a grid the rest of its row widens to fill it. */
  const without = (t: Tab, id: string) => (isGridTab(t) ? removeFromGrid(t.sections, id, defaultSpan) : t.sections.filter((s) => s.id !== id));

  const selectedTab = selection?.kind === "tab" ? config.tabs.find((t) => t.id === selection.id) ?? null : null;
  const tabIgnored = ignoredTabSettings(config.layout, config.tabs.length);

  const sensors = useSensors(
    // A small distance threshold keeps a plain click a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- edits ---

  const addTab = () => {
    const id = uniqueId(config, "new-tab");
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
    const section = newSection(config, toTabId, type);
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

  const moveSection = (sectionId: string, fromTabId: string, toTabId: string) => {
    if (fromTabId === toTabId) return;
    update((c) => {
      const section = c.tabs.find((t) => t.id === fromTabId)?.sections.find((s) => s.id === sectionId);
      if (!section) return c;
      return {
        ...c,
        tabs: c.tabs.map((t) =>
          t.id === fromTabId ? { ...t, sections: without(t, sectionId) } : t.id === toTabId ? { ...t, sections: [...t.sections, section] } : t
        ),
      };
    });
    setTabId(toTabId);
    setSelection({ kind: "section", id: sectionId });
  };

  /** The section being dragged (a stand-in for a palette widget), or null for tabs. */
  const draggedItem = (a: string): Section | null => {
    if (a.startsWith(SEC)) return tab?.sections.find((s) => SEC + s.id === a) ?? null;
    if (a.startsWith(NEW)) return { id: NEW_ITEM, type: a.slice(NEW.length) } as Section;
    return null;
  };

  // Grid view: work out the drop position and its result while dragging, so the outline can show
  // where the widget would land, or that there is no room, before it is dropped.
  const onDragMove = (e: DragMoveEvent) => {
    if (!gridView || !tab) return;
    const item = draggedItem(String(e.active.id));
    const o = e.over ? String(e.over.id) : "";
    const p = pointerOf(e);
    let target: DropTarget | null = null;
    if (item && o === GRID_END) target = { id: null, side: "end" };
    else if (item && o.startsWith(CELL) && p && e.over) target = { id: o.slice(CELL.length), side: sideOf(p, e.over.rect) };
    if (!target || target.id === item?.id) {
      if (hover) setHover(null);
      return;
    }
    if (hover && hover.target.id === target.id && hover.target.side === target.side) return;
    setHover({ target, result: placeInGrid(tab.sections, item!, target, defaultSpan) });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const gridDrop = hover;
    setHover(null);
    if (!over || !tab) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a === o) return;

    if (gridView && gridDrop && (o.startsWith(CELL) || o === GRID_END)) {
      if (!gridDrop.result.ok) {
        if (gridDrop.result.reason) setNotice(`${gridDrop.result.reason} The widget went back to where it was.`);
        return;
      }
      // The result was worked out against this config; recompute inside the (pure) updater anyway.
      const item = a.startsWith(NEW) ? newSection(config, tab.id, a.slice(NEW.length)) : draggedItem(a);
      if (!item) return;
      update((c) =>
        mapTab(c, tab.id, (t) => {
          const r = placeInGrid(t.sections, item, gridDrop.target, defaultSpan);
          return r.ok ? { ...t, sections: r.items } : t;
        })
      );
      setSelection({ kind: "section", id: item.id });
      return;
    }

    if (a.startsWith(TAB) && o.startsWith(TAB)) {
      update((c) => {
        const from = c.tabs.findIndex((t) => TAB + t.id === a);
        const to = c.tabs.findIndex((t) => TAB + t.id === o);
        return from < 0 || to < 0 ? c : { ...c, tabs: arrayMove(c.tabs, from, to) };
      });
    } else if (a.startsWith(SEC)) {
      if (o.startsWith(SEC)) {
        update((c) =>
          mapTab(c, tab.id, (t) => {
            const from = t.sections.findIndex((s) => SEC + s.id === a);
            const to = t.sections.findIndex((s) => SEC + s.id === o);
            return from < 0 || to < 0 ? t : { ...t, sections: arrayMove(t.sections, from, to) };
          })
        );
      } else if (o.startsWith(TAB)) {
        moveSection(a.slice(SEC.length), tab.id, o.slice(TAB.length));
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
      const s = tab?.sections.find((x) => SEC + x.id === dragging);
      return s ? widget(s.type) : null;
    }
    const t = config.tabs.find((x) => TAB + x.id === dragging);
    return t ? { icon: t.icon ?? "", label: t.label } : null;
  })();

  // --- outline ---

  const outline = (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => {
        setDragging(String(e.active.id));
        setNotice(null);
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setHover(null);
      }}
    >
      <div className="adm-panel-head">
        <h2>Tabs</h2>
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
              {notice && (
                <p className="adm-notice is-bad adm-grid-notice" role="status">
                  {notice}
                </p>
              )}
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

      {/* A refused grid drop animates back to where the widget came from; anything else lands instantly. */}
      <DragOverlay dropAnimation={hover && !hover.result.ok ? defaultDropAnimation : null}>
        {overlayLabel && (
          <div className="adm-row is-overlay">
            <span className="adm-row-icon" aria-hidden>
              {overlayLabel.icon}
            </span>
            <span className="adm-row-text">
              <span className="adm-row-title">{overlayLabel.label}</span>
              {/* Grid view: where it would land (or why it can't), right next to the pointer. */}
              {gridView && hover && tab && (
                <span className={`adm-overlay-hint${hover.result.ok ? "" : " is-bad"}`} aria-live="polite">
                  {gridStatus(hover, tab.sections, defaultSpan)}
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

  if (selectedRow.length) {
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
      const copy = { ...structuredClone(selectedSection), id: uniqueId(config, `${tab.id}-${selectedSection.type}`) } as Section;
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
              {layoutGrid.arrange === "stack" ? (
                <>The Link in bio layout shows every widget at full width, so there is no width to set here.</>
              ) : (
                <>
                  Widths apply where widgets can sit side by side. To set this widget&apos;s width, select the tab &ldquo;{tab.label}&rdquo; and set{" "}
                  <strong>Arrange widgets</strong> to <strong>Grid</strong> (or pick the Bento layout on the Site screen).
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
          {config.tabs.length > 1 && (
            <label className="adm-field">
              <span className="adm-label">Move to tab</span>
              <select className="adm-input" value={tab.id} onChange={(e) => moveSection(selectedSection.id, tab.id, e.target.value)}>
                {config.tabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
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

  return { outline, inspector, tabSlug: tab ? slugify(tab.label) : "" };
}
