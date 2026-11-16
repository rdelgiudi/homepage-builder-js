import CommentsWidget from "@/components/CommentsWidget";
import type { WidgetView } from "../types";
import type { CommentsSection } from "./meta";

export const view: WidgetView<CommentsSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <CommentsWidget limit={section.limit} enableGradientBorders={ctx.gradientBorders} />,
};
