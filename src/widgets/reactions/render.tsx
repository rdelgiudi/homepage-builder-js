import ReactionsWidget from "@/components/ReactionsWidget";
import type { WidgetView } from "../types";
import type { ReactionsSection } from "./meta";

export const view: WidgetView<ReactionsSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <ReactionsWidget emojis={section.emojis} enableGradientBorders={ctx.gradientBorders} />,
};
