import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("discord-user"),
  ...titleFields,
  ...frameField,
});
export type DiscordUserSection = z.infer<typeof schema>;

export const meta = {
  type: "discord-user",
  label: "Discord Status",
  icon: "🟢",
  category: "social",
  description: "Live Discord presence and activities",
  schema,
  defaults: {},
  requiresEnv: ["DISCORD_USER_ID", "DISCORD_BOT_TOKEN"],
} satisfies WidgetMeta;
