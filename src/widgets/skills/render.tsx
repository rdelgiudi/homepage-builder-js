import { alignClass, Icon } from "../shared";
import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { SkillsSection } from "./meta";

export const view: WidgetView<SkillsSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => {
    if (!section.items.length) return <Notice>Add skills in this widget&apos;s settings.</Notice>;
    return (
      <ul className={`flex flex-wrap gap-2 ${alignClass(section.align)}`}>
        {section.items.map((item, i) => (
          <li key={i} className="inline-flex items-center gap-2 rounded-lg bg-gray-200 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100">
            {item.icon && <Icon icon={item.icon} width={18} height={18} />}
            <span>{item.label}</span>
            {item.level !== undefined && (
              <span className="flex gap-0.5" role="img" aria-label={`Level ${item.level} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= item.level! ? "bg-blue-500" : "bg-gray-400/40"}`} />
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  },
};
