import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("twitch"),
  ...titleFields,
  ...frameField,
  username: z.string().default("").meta({ title: "Twitch username" }),
  hideOffline: z.boolean().default(false).meta({ title: "Hide while offline", description: "Only show the widget while you are live" }),
});

export type TwitchSection = z.infer<typeof schema>;

export const meta = {
  type: "twitch",
  label: "Twitch",
  icon: "🟣",
  category: "media",
  description: "Shows when you are live on Twitch, with the stream title and viewers",
  schema,
  defaults: { username: "", hideOffline: false },
  requiresEnv: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"],
} satisfies WidgetMeta;
