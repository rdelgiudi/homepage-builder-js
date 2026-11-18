import { z } from "zod";
import { base, titleFields, frameField, progressColorsField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("discord-user"),
  ...titleFields,
  ...frameField,
  ...progressColorsField,
  progressAnimation: z.boolean().default(true).meta({
    title: "Animate progress bar gradient",
    description: "Off = the colors stay still. Has no effect when the progress gradient is turned off in Effects",
  }),
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
