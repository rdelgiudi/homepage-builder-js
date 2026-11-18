import DiscordUser from "@/components/DiscordUser";
import type { WidgetView } from "../types";
import { progressColors } from "../progress";
import type { DiscordUserSection } from "./meta";

export const view: WidgetView<DiscordUserSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => (
    <DiscordUser
      enableGradient={ctx.progressGradient}
      animateGradient={section.progressAnimation}
      gradientColors={progressColors(section.progressColors, ctx)}
      framed={ctx.framed}
    />
  ),
};
