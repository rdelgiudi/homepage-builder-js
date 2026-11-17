import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("play-history"),
  ...titleFields,
  ...frameField,
  months: z.number().int().min(1).max(12).default(6).meta({ title: "Months to show" }),
  timezone: z.string().default("UTC").meta({ title: "Time zone", ui: "timezone", description: "Where your days start and end" }),
  showGames: z.boolean().default(true).meta({ title: "Show most-played games" }),
  showRecent: z.boolean().default(false).meta({ title: "Show recent sessions" }),
  hideGames: z
    .array(z.string())
    .default([])
    .meta({ title: "Games to leave out", description: "Exact names as Discord shows them. Still recorded, never shown" }),
});

export type PlayHistorySection = z.infer<typeof schema>;

export const meta = {
  type: "play-history",
  label: "Play history",
  icon: "📅",
  category: "gaming",
  description: "Heatmap of the hours you play, recorded from your Discord status",
  schema,
  defaults: { months: 6, timezone: "Europe/Rome", showGames: true, showRecent: false, hideGames: [] },
  requiresEnv: ["DISCORD_USER_ID", "DISCORD_BOT_TOKEN"],
} satisfies WidgetMeta;
