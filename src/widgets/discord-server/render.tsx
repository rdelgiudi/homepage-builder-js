import DiscordServer from "@/components/DiscordServer";
import type { WidgetView } from "../types";
import type { DiscordServerSection } from "./meta";

export const view: WidgetView<DiscordServerSection> = {
  titled: true,
  frame: "wrap",
  render: (_section, ctx) => <DiscordServer serverId={ctx.discordServerId} />,
};
