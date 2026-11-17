import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("steam-rare"),
  ...titleFields,
  ...frameField,
  limit: z.number().int().min(1).max(20).default(6).meta({ title: "Achievements to show" }),
  scanGames: z
    .number()
    .int()
    .min(5)
    .max(100)
    .default(40)
    .meta({ title: "Games to look through", description: "Your most-played games. More = a slower first load (refreshed every 6 hours)" }),
  layout: z.enum(["list", "grid"]).default("list").meta({ title: "Layout" }),
  columns: z
    .number()
    .int()
    .min(2)
    .max(6)
    .default(3)
    .meta({ title: "Columns", description: "Grid layout, on wide screens (two on phones)", showIf: { layout: ["grid"] } }),
  showHidden: z
    .boolean()
    .default(false)
    .meta({ title: "Uncover hidden achievements", description: "Off = spoiler achievements show only the game until a visitor clicks to see them" }),
  rareBorder: z.boolean().default(true).meta({ title: "Rare border", description: "Animated gold ring around achievements fewer than 10% of players have" }),
});

export type SteamRareSection = z.infer<typeof schema>;

export const meta = {
  type: "steam-rare",
  label: "Rarest achievements",
  icon: "🏆",
  category: "gaming",
  description: "Your rarest unlocked Steam achievements, by global unlock rate",
  schema,
  defaults: { limit: 6, scanGames: 40, layout: "list", columns: 3, showHidden: false, rareBorder: true },
  requiresEnv: ["STEAM_API_KEY", "STEAM_ID"],
} satisfies WidgetMeta;
