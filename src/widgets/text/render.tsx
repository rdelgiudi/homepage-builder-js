import { Icon, alignClass } from "../shared";
import type { WidgetView } from "../types";
import type { TextSection } from "./meta";

export const view: WidgetView<TextSection> = {
  titled: false,
  frame: "none",
  render: (section) => (
    <div className={`flex items-center gap-3 text-lg text-gray-600 dark:text-gray-300 ${alignClass(section.align)}`}>
      {section.icon && <Icon icon={section.icon} className="text-2xl" width={28} height={28} invertDark={section.invertDark} />}
      <p>{section.content}</p>
    </div>
  ),
};
