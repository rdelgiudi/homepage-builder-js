import { Card, Notice } from "../common";
import type { WidgetView } from "../types";
import type { FaqSection } from "./meta";

export const view: WidgetView<FaqSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => {
    const items = section.items.filter((item) => item.question.trim());
    if (!items.length) return <Notice>Add a question in this widget&apos;s settings.</Notice>;
    return (
      <Card className="text-left !p-0 divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item, i) => (
          // Native <details>: works without JavaScript, keyboard and screen-reader friendly.
          <details key={i} open={section.openFirst && i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-gray-900 dark:text-white [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 break-words">{item.question}</span>
              <span className="shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            {item.answer && <p className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">{item.answer}</p>}
          </details>
        ))}
      </Card>
    );
  },
};
