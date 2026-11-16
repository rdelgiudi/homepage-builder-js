import DiscordUser from "@/components/DiscordUser";
import type { WidgetView } from "../types";
import type { DiscordUserSection } from "./meta";

export const view: WidgetView<DiscordUserSection> = {
  titled: true,
  frame: "wrap",
  render: (_section, ctx) => (
    <DiscordUser enableGradient={ctx.progressGradient} gradientColors={ctx.progressGradientColors} titleGradientColors={ctx.titleGradient} framed={ctx.framed} />
  ),
};
