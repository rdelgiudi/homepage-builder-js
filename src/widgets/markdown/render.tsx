import MarkdownWidget from "@/components/MarkdownWidget";
import type { WidgetView } from "../types";
import type { MarkdownSection } from "./meta";

export const view: WidgetView<MarkdownSection> = {
  titled: false,
  frame: "wrap",
  render: (section) => <MarkdownWidget file={section.file} />,
};
