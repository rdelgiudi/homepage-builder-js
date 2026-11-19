"use client";

import { useEffect } from "react";
import type { Section } from "@/widgets/meta";
import type { WidgetContext } from "@/widgets/types";
import TabSections from "@/components/TabSections";
import ConfigSync from "@/components/ConfigSync";
import { COLUMN_GRID } from "@/lib/layouts";

/**
 * One widget, nothing around it (no page colour, header, counters, effects or theme
 * switch), for the stream overlay page. Rendered through TabSections like on the site, so
 * the title row, frame and widget context behave the same. ConfigSync refreshes it when
 * the site is published.
 */
export default function OverlayView({ section, widgetContext, theme }: { section: Section; widgetContext: WidgetContext; theme: "light" | "dark" }) {
  // The colours come from `?theme`, never from (or into) the visitor's saved theme.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <div className="p-2">
      <TabSections tab={{ id: "overlay", label: "Overlay", layout: "stack", sections: [section] }} widgetContext={widgetContext} grid={COLUMN_GRID} />
      <ConfigSync preview={false} />
    </div>
  );
}
