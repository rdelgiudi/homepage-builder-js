"use client";

import { Icon } from "@/widgets/shared";
import { useScrollStrip } from "./useScrollStrip";

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  invertDark?: boolean;
}

interface TabStripProps {
  /** The buttons of this row (a split row shows only some of the tabs). */
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /**
   * `tabs` the desktop tab bar · `uniform` the same small row at every width (link in bio) ·
   * `jump` the one-page layout's jump links.
   */
  variant: "tabs" | "uniform" | "jump";
  align: "left" | "center" | "right";
  /** In one row with the title: tighter, there is less room. */
  tight?: boolean;
  label: string;
  className?: string;
}

const ALIGN = { left: "", center: "is-centered", right: "is-right" };

/** A row of tab buttons that scrolls sideways (with fades) when they don't fit. */
export default function TabStrip({ items, activeId, onSelect, variant, align, tight = false, label, className = "" }: TabStripProps) {
  const strip = useScrollStrip<HTMLDivElement>(activeId, items.length);
  const gap = variant === "uniform" ? "gap-1" : variant === "jump" ? (tight ? "gap-1" : "gap-1 md:gap-4") : tight ? "gap-1" : "gap-4";

  return (
    // `min-w-0`: as a flex item it would otherwise refuse to shrink below its buttons and run out
    // of the page column. The side padding (taken back by the margin) is room for a hovered tab to
    // grow: without it the tab at the row's end made the row scroll.
    // The `safe` alignments start it at the left when it overflows.
    <div ref={strip.ref} style={strip.style} role="navigation" aria-label={label} className={`scroll-strip ${ALIGN[align]} flex ${gap} flex-1 min-w-0 overflow-x-auto${variant === "jump" ? "" : " py-1 px-2 -mx-2"} ${className}`}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? (variant === "jump" ? "true" : "page") : undefined}
            className={
              variant === "jump"
                ? `flex shrink-0 items-center gap-1.5 md:gap-2 px-2.5 ${tight ? "md:px-3" : "md:px-4"} py-2.5 md:py-3 text-sm md:text-base whitespace-nowrap border-b-2 transition-colors duration-200 ${
                    active ? "text-blue-600 dark:text-white border-blue-600 dark:border-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border-transparent"
                  }`
                : `flex shrink-0 items-center whitespace-nowrap ${variant === "uniform" ? "gap-1.5 px-2.5 py-1.5 text-sm" : tight ? "gap-2 px-3 py-2" : "gap-2 px-4 py-2"} transition-all duration-200 ${
                    active
                      ? "text-blue-600 dark:text-white border-b-2 border-blue-600 dark:border-blue-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:scale-105 gradient-tab" + (tight ? " pb-2.5" : "")
                  }`
            }
          >
            {item.icon && (variant === "jump" ? <Icon icon={item.icon} invertDark={item.invertDark} width={18} height={18} /> : <Icon icon={item.icon} invertDark={item.invertDark} />)}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
