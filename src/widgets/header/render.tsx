import { Icon, alignClass } from "../shared";
import type { WidgetView } from "../types";
import type { HeaderSection } from "./meta";

export const view: WidgetView<HeaderSection> = {
  titled: false,
  frame: "none",
  render: (section) => (
    <div className={alignClass(section.align)}>
      {section.icon && <Icon icon={section.icon} className="text-6xl block mb-4" width={60} height={60} invertDark={section.invertDark} />}
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
    </div>
  ),
};
