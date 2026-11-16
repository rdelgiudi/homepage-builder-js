import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("discord-server"),
  ...titleFields,
  ...frameField,
});
export type DiscordServerSection = z.infer<typeof schema>;

export const meta = {
  type: "discord-server",
  label: "Discord Server",
  icon: "💬",
  category: "social",
  description: "Discord server widget with online members",
  schema,
  defaults: {},
  requiresEnv: ["DISCORD_SERVER_ID"],
} satisfies WidgetMeta;
