import { Icon, alignClass } from "../shared";
import { opens } from "@/lib/url";
import type { WidgetView } from "../types";
import type { LinksSection } from "./meta";

export const view: WidgetView<LinksSection> = {
  titled: true,
  frame: "none",
  render: (section, ctx) => (
    <div className={`flex flex-wrap gap-3 ${alignClass(section.align)}`}>
      {section.items.map((item, i) => (
        <a
          key={i}
          href={item.url}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:scale-105${ctx.gradientBorders ? " gradient-border-card" : ""} ${
            item.style === "primary"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white"
          }`}
          // Pages of this site ("/page-2") open in the same tab.
          {...opens(item.url)}
        >
          {item.icon && <Icon icon={item.icon} invertDark={item.invertDark} />}
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  ),
};
