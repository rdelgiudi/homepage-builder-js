import type { WidgetView } from "../types";
import type { DividerSection } from "./meta";

const SPACE = { small: "py-1", medium: "py-4", large: "py-10" };

export const view: WidgetView<DividerSection> = {
  titled: false,
  frame: "none",
  render: (section) => (
    <div className={SPACE[section.size]} role="separator">
      {section.style === "line" && <hr className="border-gray-300 dark:border-gray-700" />}
      {section.style === "dots" && <p className="text-center tracking-[1em] text-gray-400 dark:text-gray-500" aria-hidden>•••</p>}
    </div>
  ),
};
