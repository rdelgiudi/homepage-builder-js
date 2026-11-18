"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
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
import { SpanControl } from "./LayoutControls";
import { WidgetIcon } from "@/widgets/BrandIcon";

type Selection = { kind: "tab" | "section"; id: string } | null;
type Obj = Record<string, unknown>;

// Drag ids are prefixed so one DndContext can tell tabs, sections and palette items apart.
const TAB = "tab:";
const SEC = "sec:";
const NEW = "new:";
const LIST = "section-list";

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

interface EnvStatus {
  type: string;
  env: { name: string; set: boolean }[];
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
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);

  useEffect(() => {
    api<{ widgets: EnvStatus[] }>("integrations")
      .then((d) => setEnvStatus(d.widgets))
      .catch(() => {});
  }, []);
  const missingEnv = (type: string) => envStatus.find((w) => w.type === type)?.env.filter((e) => !e.set).map((e) => e.name) ?? [];

  const tab = config.tabs.find((t) => t.id === tabId) ?? config.tabs[0] ?? null;
  const selectedSection = selection?.kind === "section" ? tab?.sections.find((s) => s.id === selection.id) ?? null : null;
  // Widths matter where widgets can sit side by side: grid tabs, and every tab in the bento layout.
  const bento = config.layout.site === "bento";
  const gridActive = bento || tab?.layout === "grid";
  const defaultSpan = bento ? 6 : 12;

  const selectedTab = selection?.kind === "tab" ? config.tabs.find((t) => t.id === selection.id) ?? null : null;

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
          t.id === fromTabId ? { ...t, sections: t.sections.filter((s) => s.id !== sectionId) } : t.id === toTabId ? { ...t, sections: [...t.sections, section] } : t
        ),
      };
    });
    setTabId(toTabId);
    setSelection({ kind: "section", id: sectionId });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || !tab) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a === o) return;

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
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setDragging(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
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
          </div>
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

          <div className="adm-panel-head">
            <h2>Add a widget</h2>
          </div>
          <p className="adm-hint adm-pad">Click to add at the end, or drag into the list or onto another tab.</p>
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

      <DragOverlay dropAnimation={null}>
        {overlayLabel && (
          <div className="adm-row is-overlay">
            <span className="adm-row-icon" aria-hidden>
              {overlayLabel.icon}
            </span>
            <span className="adm-row-title">{overlayLabel.label}</span>
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

  if (selectedTab) {
    inspector = (
      <>
        <div className="adm-panel-head">
          <h2>Tab settings</h2>
        </div>
        <div className="adm-pad">
          <SchemaForm
            schema={formSchemas.tab}
            value={selectedTab as unknown as Obj}
            onChange={(v) => update((c) => mapTab(c, selectedTab.id, (t) => ({ ...(v as unknown as Tab), sections: t.sections })))}
          />
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
      update((c) => mapTab(c, tab.id, (t) => ({ ...t, sections: t.sections.filter((s) => s.id !== selectedSection.id) })));
      setSelection(null);
    };
    const duplicate = () => {
      const copy = { ...structuredClone(selectedSection), id: uniqueId(config, `${tab.id}-${selectedSection.type}`) } as Section;
      update((c) =>
        mapTab(c, tab.id, (t) => {
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
          {gridActive && (
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
                      return (span === undefined ? rest : { ...rest, span }) as Section;
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
