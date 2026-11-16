import MemeWidget from "@/components/MemeWidget";
import type { WidgetView } from "../types";
import type { MemeSection } from "./meta";

export const view: WidgetView<MemeSection> = {
  titled: true,
  // The frame wraps only the image, so MemeWidget draws it itself.
  frame: "self",
  render: (section, ctx) => (
    <MemeWidget enableGradientBorders={ctx.gradientBorders} widgetFrameEnabled={ctx.framed} widgetFrameWidth={ctx.widgetFrameWidth} widgetFrameGradient={ctx.titleGradient} popular={section.popular} />
  ),
};
