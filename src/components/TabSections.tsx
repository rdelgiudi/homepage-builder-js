"use client";

import type { CSSProperties } from "react";
import type { Tab } from "@/lib/schema/config";
import { renderSection } from "@/widgets/registry";
import type { WidgetContext } from "@/widgets/types";
import { arrangeOf, type GridOptions } from "@/lib/layouts";

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
 * One tab's widgets, arranged as a stack, a 12-column grid or masonry columns. Shared by
 * every site layout. Grid and masonry respond to the width of their own column (container
 * queries on `.section-grid-wrap`), not the window's, so narrow page columns stay one
 * widget per row.
 */
export default function TabSections({ tab, widgetContext, animate, grid }: TabSectionsProps) {
  const arrange = arrangeOf(grid ?? { arrange: "choice", defaultSpan: 12 }, tab);
  const isGrid = arrange === "grid";
  // Admin preview only: the panel finds tabs and widgets by these to drop new ones onto the page.
  const marked = !!widgetContext.preview;
  const className = arrange === "grid" ? "section-grid gap-6 md:gap-8" : arrange === "masonry" ? "section-masonry" : "space-y-6 md:space-y-8";
  const stack = (
    <div className={className} data-cols={arrange === "masonry" ? grid?.columns : undefined} data-tab-id={marked ? tab.id : undefined}>
      {tab.sections.map((section, index) => (
        <div
          key={section.id}
          data-section-id={marked ? section.id : undefined}
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
  return arrange === "stack" ? stack : <div className="section-grid-wrap">{stack}</div>;
}
