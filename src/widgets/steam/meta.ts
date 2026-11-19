import { z } from "zod";
import { base, titleFields, frameField, progressAnimationField, progressColorsField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("steam"),
  ...titleFields,
  ...frameField,
  showRecent: z.boolean().default(true).meta({ title: "Recently played", description: "Row of games played in the last two weeks" }),
  showTop: z.boolean().default(true).meta({ title: "Top games", description: "Row of your most-played games" }),
  ...progressColorsField,
  // Achievement bars: animation only. Sparkles mark a moving position, which these bars don't have.
  ...progressAnimationField,
});
export type SteamSection = z.infer<typeof schema>;

export const meta = {
  type: "steam",
  label: "Steam",
  icon: "🎮",
  category: "gaming",
  description: "Steam profile, recent and top games with achievements",
  schema,
  defaults: { showRecent: true, showTop: true },
  requiresEnv: ["STEAM_API_KEY", "STEAM_ID"],
} satisfies WidgetMeta;
