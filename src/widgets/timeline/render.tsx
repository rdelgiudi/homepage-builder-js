import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { TimelineSection } from "./meta";

export const view: WidgetView<TimelineSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => {
    if (!section.items.length) return <Notice>Add events in this widget&apos;s settings.</Notice>;
    return (
      <ol className="relative ml-2 border-l border-gray-300 dark:border-gray-700 space-y-6 text-left">
        {section.items.map((item, i) => (
          <li key={i} className="relative pl-6">
            <span className="absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full bg-blue-500" aria-hidden />
            {item.date && <p className="text-xs text-gray-500 dark:text-gray-400">{item.date}</p>}
            <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
            {item.text && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{item.text}</p>}
          </li>
        ))}
      </ol>
    );
  },
};
