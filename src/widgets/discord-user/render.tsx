import DiscordUser from "@/components/DiscordUser";
import type { WidgetView } from "../types";
import type { DiscordUserSection } from "./meta";

export const view: WidgetView<DiscordUserSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => (
    <DiscordUser
      enableGradient={ctx.progressGradient}
      animateGradient={section.progressAnimation}
      gradientColors={section.progressColors?.length ? section.progressColors : ctx.progressGradientColors}
      titleGradientColors={ctx.titleGradient}
      framed={ctx.framed}
    />
  ),
};
