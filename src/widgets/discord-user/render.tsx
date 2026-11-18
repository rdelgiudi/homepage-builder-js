import DiscordUser from "@/components/DiscordUser";
import type { WidgetView } from "../types";
import { progressStyle } from "../progress";
import type { DiscordUserSection } from "./meta";

export const view: WidgetView<DiscordUserSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <DiscordUser progress={progressStyle(section, ctx)} framed={ctx.framed} />,
};
