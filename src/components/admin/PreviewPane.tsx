"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { PREVIEW_REFRESH, PREVIEW_SHOWN, PREVIEW_TAB } from "@/components/ConfigSync";
import { widgetMetaByType } from "@/widgets/meta";
import { useAdmin } from "./store";
import { PREVIEW_MOVE, type Box } from "./preview-drop";

/** Droppable id of the preview (the builder's DndContext wraps the whole work area). */
export const PREVIEW_DROP = "preview";

/** What the builder tells the preview while a widget is dragged over it. */
export interface PreviewDropState {
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** The tab slug the preview is known to show; a tab change is posted only when it differs. */
  shownSlug: RefObject<string>;
  /** A widget (palette or outline) is being dragged: the drop layer is up. */
  active: boolean;
  /** Where it would land, in the iframe's viewport coordinates. */
  marker: { box: Box; side: string; bad: boolean } | null;
  /** Just dropped here: shown until the preview has the new draft. */
  placing: { box: Box; side: string; label: string } | null;
  /** The move handle was clicked (not dragged): select that widget in the builder. */
  onSelect: (id: string) => void;
  /** The widget selected in the builder, outlined in the preview. */
  selectedId: string | null;
  /** The preview switched tab itself (its tab bar, a one-page jump or scroll): the builder follows. */
  onTabShown: (slug: string) => void;
}

/**
 * The handle shown on the widget under the pointer. Dragging it moves the widget with the same
 * drag-and-drop as the outline (events that start inside the iframe can't drive the panel's
 * drag, so the handle lives in the panel, above the iframe); a click selects the widget.
 */
function MoveHandle({ id, label, box, onSelect }: { id: string; label: string; box: Box; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: PREVIEW_MOVE + id });
  // Pointer only: a keyboard drag has no coordinates over the preview (the outline is the keyboard route).
  const { onKeyDown: _keyboardDrag, ...pointer } = listeners ?? {};
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="adm-move-handle"
      // Straddles the widget's top edge so it covers as little of the widget as possible.
      style={{ left: box.left + 10, top: Math.max(4, box.top - 12) }}
      {...attributes}
      {...pointer}
      aria-label={`Move or select the ${label} widget`}
      title="Drag to move this widget. Click to edit it."
      onClick={() => onSelect(id)}
    >
      <span aria-hidden>⠿</span> {label}
    </button>
  );
}

/** The real site, rendered from the draft, in an iframe that follows every saved edit. */
export default function PreviewPane({ tabSlug, drop, editable }: { tabSlug: string; drop: PreviewDropState; editable: boolean }) {
  const { savedTick, hasDraft, config } = useAdmin();
  const { frameRef: frame, shownSlug } = drop;
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  // The src is fixed at mount; later tab changes are sent as messages so the page never reloads.
  const [src] = useState(() => `/admin/preview${tabSlug ? `?tab=${encodeURIComponent(tabSlug)}` : ""}`);
  const { setNodeRef, isOver } = useDroppable({ id: PREVIEW_DROP });

  const post = useCallback(
    (message: unknown) => {
      frame.current?.contentWindow?.postMessage(message, window.location.origin);
    },
    [frame]
  );

  // The preview reports its own tab switches; only messages from this iframe count.
  const onTabShown = useRef(drop.onTabShown);
  onTabShown.current = drop.onTabShown;
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === PREVIEW_SHOWN && typeof e.data.tab === "string") onTabShown.current(e.data.tab);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame]);

  useEffect(() => {
    if (savedTick > 0) post(PREVIEW_REFRESH);
  }, [savedTick, post]);

  useEffect(() => {
    // Not when the preview already shows it: after a drop on the one-page layout, re-sending
    // the tab would scroll the preview away from the widget that was just placed.
    if (!tabSlug || tabSlug === shownSlug.current) return;
    shownSlug.current = tabSlug;
    post({ type: PREVIEW_TAB, tab: tabSlug });
  }, [tabSlug, post, shownSlug]);

  // A placed widget's marker stays until the refreshed preview has arrived (or gives up).
  const [placing, setPlacing] = useState<PreviewDropState["placing"]>(null);
  const placedAt = useRef(savedTick);
  useEffect(() => {
    setPlacing(drop.placing);
    placedAt.current = savedTick;
    if (!drop.placing) return;
    const t = setTimeout(() => setPlacing(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new drop restarts it
  }, [drop.placing]);
  useEffect(() => {
    if (savedTick === placedAt.current) return;
    // The refresh itself takes a moment after the save.
    const t = setTimeout(() => setPlacing(null), 700);
    return () => clearTimeout(t);
  }, [savedTick]);

  const marker = drop.active && isOver ? drop.marker : null;

  // The widget under the pointer, for the move handle (builder screen only). The iframe is
  // same-origin, so its own pointer events are read directly.
  const [hovered, setHovered] = useState<{ id: string; box: Box } | null>(null);
  const hoveredEl = useRef<HTMLElement | null>(null);
  const dragging = useRef(drop.active);
  dragging.current = drop.active;
  useEffect(() => {
    const f = frame.current;
    if (!editable || !f) return;
    let doc: Document | null = null;
    let win: Window | null = null;
    const measure = () => {
      const el = hoveredEl.current;
      if (!el?.isConnected || !el.dataset.sectionId) {
        hoveredEl.current = null;
        if (!dragging.current) setHovered(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setHovered({ id: el.dataset.sectionId, box: { left: r.left, top: r.top, width: r.width, height: r.height } });
    };
    const onMove = (e: PointerEvent) => {
      if (dragging.current) return;
      // Duck-typed: the target belongs to the iframe's realm, so `instanceof Element` would fail.
      const target = e.target as { closest?: (selector: string) => Element | null } | null;
      hoveredEl.current = (target?.closest?.("[data-section-id]") as HTMLElement | null) ?? null;
      measure();
    };
    const detach = () => {
      doc?.removeEventListener("pointermove", onMove);
      win?.removeEventListener("scroll", measure);
    };
    const attach = () => {
      detach();
      doc = f.contentDocument;
      win = f.contentWindow;
      doc?.addEventListener("pointermove", onMove, { passive: true });
      win?.addEventListener("scroll", measure, { passive: true });
    };
    f.addEventListener("load", attach);
    attach();
    return () => {
      f.removeEventListener("load", attach);
      detach();
      hoveredEl.current = null;
      setHovered(null);
    };
  }, [editable, frame]);
  // After a drag or a refreshed draft the widget may have moved: wait for the pointer again.
  useEffect(() => {
    if (drop.active) return;
    hoveredEl.current = null;
    setHovered(null);
  }, [drop.active, savedTick]);

  const hoveredSection = hovered ? config.tabs.flatMap((t) => t.sections).find((s) => s.id === hovered.id) : undefined;

  return (
    <section className="adm-preview" aria-label="Preview">
      <div className="adm-preview-bar">
        <span className="adm-muted">{hasDraft ? "Preview of your draft" : "Preview — same as the live site"}</span>
        <div className="adm-seg" role="group" aria-label="Preview size">
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
            Desktop
          </button>
          <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}>
            Phone
          </button>
        </div>
      </div>
      <div className="adm-preview-stage">
        <div
          ref={setNodeRef}
          className={`adm-preview-frame${device === "phone" ? " is-phone" : ""}`}
          // Leaving the preview (not onto the handle, which is inside this element) hides the handle.
          onPointerLeave={() => {
            if (drop.active) return;
            hoveredEl.current = null;
            setHovered(null);
          }}
        >
          <iframe ref={frame} src={src} title="Site preview" />
          {/* While dragging, this layer takes the pointer (an iframe would swallow the drag's
              move events); the builder passes the wheel on to the page. */}
          {(drop.active || placing || hovered) && (
            <div className={`adm-drop-layer${drop.active ? " is-active" : ""}${drop.active && isOver ? " is-over" : ""}`}>
              {hovered && hoveredSection && !drop.active && (
                <div className={`adm-hover-box${hovered.id === drop.selectedId ? " is-selected" : ""}`} style={boxStyle(hovered.box)} />
              )}
              {/* Stays mounted during its own drag: it is the drag's source. */}
              {hovered && hoveredSection && (
                <MoveHandle id={hovered.id} label={widgetMetaByType[hoveredSection.type]?.label ?? "widget"} box={hovered.box} onSelect={drop.onSelect} />
              )}
              {marker && <div className={`adm-drop-marker${marker.bad ? " is-bad" : ""}`} data-side={marker.side} style={boxStyle(marker.box)} />}
              {!drop.active && placing && (
                <div className="adm-drop-marker is-placing" data-side={placing.side} style={boxStyle(placing.box)}>
                  <span>{placing.label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const boxStyle = (b: Box) => ({ left: b.left, top: b.top, width: b.width, height: b.height });
