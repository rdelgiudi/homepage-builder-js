"use client";

import type { CSSProperties } from "react";
import type { Tab } from "@/lib/schema/config";
import { renderSection } from "@/widgets/registry";
import type { WidgetContext } from "@/widgets/types";
import { isGridTab, type GridOptions } from "@/lib/layouts";

export type { GridOptions };

interface TabSectionsProps {
  tab: Tab;
  widgetContext: WidgetContext;
  /** Staggered fade-in for each section. */
  animate?: boolean;
  /** From the site layout (`gridOptions()` in lib/layouts.ts); unset = the tab's own setting. */
  grid?: GridOptions;
}

/**
 * One tab's widgets, arranged as a stack or a 12-column grid. Shared by every site layout.
 * The grid goes to 12 columns by the width of its own column (container query on
 * `.section-grid-wrap`), not the window's, so narrow page columns stay one widget per row.
 */
export default function TabSections({ tab, widgetContext, animate, grid }: TabSectionsProps) {
  const isGrid = isGridTab(grid ?? { arrange: "choice", defaultSpan: 12 }, tab);
  const stack = (
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
  return isGrid ? <div className="section-grid-wrap">{stack}</div> : stack;
}
