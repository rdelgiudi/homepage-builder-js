"use client";

import type { CSSProperties } from "react";
import type { Tab } from "@/lib/schema/config";
import { renderSection } from "@/widgets/registry";
import type { WidgetContext } from "@/widgets/types";

export interface GridOptions {
  /** Use the grid even when the tab itself is set to `stack` (the bento site layout). */
  force: boolean;
  /** Width of a widget that has no `span` of its own. */
  defaultSpan: number;
}

interface TabSectionsProps {
  tab: Tab;
  widgetContext: WidgetContext;
  /** Staggered fade-in for each section. */
  animate?: boolean;
  grid?: GridOptions;
}

/** One tab's widgets, arranged as a stack or a 12-column grid. Shared by every site layout. */
export default function TabSections({ tab, widgetContext, animate, grid }: TabSectionsProps) {
  const isGrid = tab.layout === "grid" || !!grid?.force;
  return (
    <div className={isGrid ? "section-grid gap-6 md:gap-8" : "space-y-6 md:space-y-8"}>
      {tab.sections.map((section, index) => (
        <div
          key={section.id}
          className={`min-w-0${animate ? " animate-fade-in-up" : ""}`}
          style={{
            ...(isGrid ? ({ "--span": section.span ?? grid?.defaultSpan ?? 12 } as CSSProperties) : null),
            ...(animate ? { animationDelay: `${index * 0.07}s` } : null),
          }}
        >
          {renderSection(section, widgetContext)}
        </div>
      ))}
    </div>
  );
}
