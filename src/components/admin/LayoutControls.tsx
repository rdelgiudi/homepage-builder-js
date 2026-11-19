"use client";

import { useRef, useState, type ReactNode } from "react";
import { SITE_LAYOUTS, type SiteLayout } from "@/lib/schema/config";
import { GRID_COLUMNS } from "@/widgets/fields";
import { useAdmin } from "./store";
import { moveDivider, rowPresets } from "./grid-layout";

// --- site layout picker ---

const LAYOUTS: Record<SiteLayout, { name: string; text: string }> = {
  tabs: { name: "Tabs", text: "Tab bar across the top, one tab shown at a time." },
  sidebar: { name: "Sidebar", text: "Your name and the tab list in a column on the left." },
  onepage: { name: "One page", text: "Every tab on one scrolling page, with jump links." },
  bento: { name: "Bento", text: "Wide page; widgets sit in a grid, two per row by default." },
  linkinbio: { name: "Link in bio", text: "One narrow column, sized for phones." },
  masonry: { name: "Masonry", text: "Widgets in staggered columns, each as tall as it needs. No gaps." },
  profile: { name: "Profile column", text: "One tab stays in a column beside the others, e.g. your profile." },
};

/** Small wireframe of each layout. Blocks: `h` header, `n` navigation, `c` content. */
function Thumb({ layout }: { layout: SiteLayout }) {
  const c = "adm-thumb-c";
  switch (layout) {
    case "tabs":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="26" y="5" width="28" height="5" rx="1.5" className="adm-thumb-h" />
          <rect x="14" y="15" width="52" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="14" y="23" width="52" height="10" rx="2" className={c} />
          <rect x="14" y="36" width="52" height="10" rx="2" className={c} />
        </svg>
      );
    case "sidebar":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="6" y="6" width="16" height="5" rx="1.5" className="adm-thumb-h" />
          <rect x="6" y="16" width="12" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="6" y="22" width="12" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="6" y="28" width="12" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="28" y="6" width="46" height="18" rx="2" className={c} />
          <rect x="28" y="28" width="46" height="18" rx="2" className={c} />
        </svg>
      );
    case "onepage":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="26" y="4" width="28" height="4" rx="1.5" className="adm-thumb-h" />
          <rect x="14" y="11" width="52" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="14" y="18" width="18" height="2.5" rx="1" className="adm-thumb-h" />
          <rect x="14" y="23" width="52" height="8" rx="2" className={c} />
          <rect x="14" y="35" width="18" height="2.5" rx="1" className="adm-thumb-h" />
          <rect x="14" y="40" width="52" height="8" rx="2" className={c} />
        </svg>
      );
    case "bento":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="26" y="4" width="28" height="4" rx="1.5" className="adm-thumb-h" />
          <rect x="6" y="11" width="68" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="6" y="18" width="32" height="14" rx="2" className={c} />
          <rect x="42" y="18" width="32" height="14" rx="2" className={c} />
          <rect x="6" y="36" width="20" height="12" rx="2" className={c} />
          <rect x="30" y="36" width="44" height="12" rx="2" className={c} />
        </svg>
      );
    case "masonry":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="26" y="4" width="28" height="4" rx="1.5" className="adm-thumb-h" />
          <rect x="6" y="11" width="68" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="6" y="18" width="21" height="16" rx="2" className={c} />
          <rect x="6" y="37" width="21" height="11" rx="2" className={c} />
          <rect x="30" y="18" width="21" height="9" rx="2" className={c} />
          <rect x="30" y="30" width="21" height="18" rx="2" className={c} />
          <rect x="54" y="18" width="20" height="12" rx="2" className={c} />
          <rect x="54" y="33" width="20" height="15" rx="2" className={c} />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="26" y="4" width="28" height="4" rx="1.5" className="adm-thumb-h" />
          <rect x="6" y="11" width="68" height="3" rx="1.5" className="adm-thumb-n" />
          <rect x="6" y="18" width="20" height="30" rx="2" className="adm-thumb-h" />
          <rect x="30" y="18" width="44" height="14" rx="2" className={c} />
          <rect x="30" y="35" width="44" height="13" rx="2" className={c} />
        </svg>
      );
    case "linkinbio":
      return (
        <svg viewBox="0 0 80 52" aria-hidden>
          <rect x="31" y="5" width="18" height="5" rx="1.5" className="adm-thumb-h" />
          <rect x="27" y="15" width="26" height="7" rx="2" className={c} />
          <rect x="27" y="25" width="26" height="7" rx="2" className={c} />
          <rect x="27" y="35" width="26" height="7" rx="2" className={c} />
        </svg>
      );
  }
}

export function LayoutPicker() {
  const { config, update } = useAdmin();
  const current = config.layout.site;
  return (
    <div className="adm-layouts" role="radiogroup" aria-label="Site layout">
      {SITE_LAYOUTS.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={id === current} className="adm-layout" onClick={() => update((c) => ({ ...c, layout: { ...c.layout, site: id } }))}>
          <Thumb layout={id} />
          <span className="adm-label">{LAYOUTS[id].name}</span>
          <span className="adm-hint">{LAYOUTS[id].text}</span>
        </button>
      ))}
    </div>
  );
}

// --- widget width in a grid ---

const PRESETS: { span: number; label: string }[] = [
  { span: 3, label: "¼" },
  { span: 4, label: "⅓" },
  { span: 6, label: "½" },
  { span: 8, label: "⅔" },
  { span: 9, label: "¾" },
  { span: 12, label: "Full" },
];

interface SpanControlProps {
  /** The widget's own width, or `undefined` when it follows the layout's default. */
  value: number | undefined;
  defaultSpan: number;
  onChange: (span: number | undefined) => void;
}

/** A 12-column bar: click or drag across it to set how wide a widget is. */
export function SpanControl({ value, defaultSpan, onChange }: SpanControlProps) {
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = value ?? defaultSpan;

  const spanAt = (clientX: number) => {
    const rect = bar.current!.getBoundingClientRect();
    return Math.min(GRID_COLUMNS, Math.max(1, Math.ceil(((clientX - rect.left) / rect.width) * GRID_COLUMNS)));
  };

  return (
    <div className="adm-field">
      <span className="adm-label">Width</span>
      <div
        ref={bar}
        className="adm-span"
        role="slider"
        tabIndex={0}
        aria-label="Width in grid columns"
        aria-valuemin={1}
        aria-valuemax={GRID_COLUMNS}
        aria-valuenow={span}
        aria-valuetext={`${span} of ${GRID_COLUMNS} columns`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          onChange(spanAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) onChange(spanAt(e.clientX));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(GRID_COLUMNS, span + 1));
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(1, span - 1));
          else return;
          e.preventDefault();
        }}
      >
        {Array.from({ length: GRID_COLUMNS }, (_, i) => (
          <span key={i} className={i < span ? "is-on" : ""} />
        ))}
      </div>
      <div className="adm-inline adm-span-presets">
        {PRESETS.map((p) => (
          <button key={p.span} type="button" className="adm-btn is-small" aria-pressed={span === p.span} onClick={() => onChange(p.span)}>
            {p.label}
          </button>
        ))}
      </div>
      <span className="adm-hint">
        {span} of {GRID_COLUMNS} columns{value === undefined ? " (the layout's default)" : ""}. On phones every widget is full width.{" "}
        {value !== undefined && (
          <button type="button" className="adm-link" onClick={() => onChange(undefined)}>
            Use the default
          </button>
        )}
      </span>
    </div>
  );
}

// --- a whole row of a grid ---

const FRACTIONS: Record<number, string> = { 3: "¼", 4: "⅓", 6: "½", 8: "⅔", 9: "¾", 12: "1" };
const fraction = (span: number) => FRACTIONS[span] ?? `${span}/12`;
const sameSpans = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

interface RowEditorProps {
  members: { id: string; label: string; icon: ReactNode }[];
  spans: number[];
  /** The widget the inspector is showing, if any (outlined in the bar). */
  current?: string;
  onCommit: (spans: number[]) => void;
  onSplit: () => void;
  onSelect?: (id: string) => void;
}

/**
 * The widths of every widget in one grid row, edited together: drag the dividers between
 * them (or focus one and use the arrow keys), or pick a preset. The total stays 12, so the
 * rows below never re-pack. While a divider is dragged the widths live here and are committed
 * once on release, so a drag is one undo step.
 */
export function RowEditor({ members, spans, current, onCommit, onSplit, onSelect }: RowEditorProps) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; base: number[] } | null>(null);
  const [live, setLive] = useState<number[] | null>(null);
  const shown = live ?? spans;

  const boundaryAt = (clientX: number) => {
    const rect = bar.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * GRID_COLUMNS;
  };
  let edge = 0;

  return (
    <div className="adm-field">
      <span className="adm-label">Row widths</span>
      <div ref={bar} className="adm-rowbar">
        {members.map((m, i) => {
          const left = edge;
          edge += shown[i];
          return (
            <button
              key={m.id}
              type="button"
              className={`adm-rowbar-seg${m.id === current ? " is-current" : ""}`}
              style={{ gridColumn: `${left + 1} / span ${shown[i]}` }}
              title={onSelect ? `Select ${m.label}` : m.label}
              onClick={() => onSelect?.(m.id)}
            >
              <span aria-hidden>{m.icon}</span>
              <span className="adm-rowbar-label">{m.label}</span>
              <span className="adm-rowbar-span">{shown[i]}/12</span>
            </button>
          );
        })}
        {shown.slice(0, -1).map((_, i) => {
          const boundary = shown.slice(0, i + 1).reduce((a, b) => a + b, 0);
          const step = (delta: number) => onCommit(moveDivider(shown, i, boundary + delta));
          return (
            <span
              key={i}
              className="adm-rowbar-divider"
              style={{ left: `${(boundary / GRID_COLUMNS) * 100}%` }}
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label={`Between ${members[i].label} and ${members[i + 1].label}`}
              aria-valuemin={1}
              aria-valuemax={GRID_COLUMNS - 1}
              aria-valuenow={boundary}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { i, base: shown };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setLive(moveDivider(drag.current.base, drag.current.i, boundaryAt(e.clientX)));
              }}
              onPointerUp={() => {
                drag.current = null;
                if (live && !sameSpans(live, spans)) onCommit(live);
                setLive(null);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setLive(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") step(1);
                else if (e.key === "ArrowLeft") step(-1);
                else return;
                e.preventDefault();
              }}
            />
          );
        })}
      </div>
      <div className="adm-inline adm-span-presets">
        {rowPresets(members.length).map((p) => (
          <button key={p.join("-")} type="button" className="adm-btn is-small" aria-pressed={sameSpans(p, shown)} onClick={() => onCommit(p)}>
            {p.map(fraction).join(" ")}
          </button>
        ))}
        <button type="button" className="adm-btn is-small" onClick={onSplit} title="Every widget of this row on a full-width row of its own">
          One per row
        </button>
      </div>
      <span className="adm-hint">Drag the dividers to share out the 12 columns. On phones every widget is full width.</span>
    </div>
  );
}

