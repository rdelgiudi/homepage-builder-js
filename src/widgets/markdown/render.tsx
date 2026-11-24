import MarkdownWidget from "@/components/MarkdownWidget";
import type { WidgetView } from "../types";
import type { MarkdownSection } from "./meta";

export const view: WidgetView<MarkdownSection> = {
  titled: false,
  frame: "wrap",
  render: (section, ctx) => <MarkdownWidget file={section.file} lang={ctx.lang} fresh={ctx.preview} />,
};
