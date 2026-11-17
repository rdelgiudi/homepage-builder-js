import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("speedrun"),
  ...titleFields,
  ...frameField,
  username: z.string().default("").meta({ title: "Speedrun.com username" }),
  sort: z.enum(["place", "recent"]).default("place").meta({ title: "Order", description: "Best placements first, or newest runs first" }),
  limit: z.number().int().min(1).max(20).default(5).meta({ title: "Runs to show" }),
  levels: z.boolean().default(false).meta({ title: "Include individual levels", description: "Off = full-game categories only" }),
});

export type SpeedrunSection = z.infer<typeof schema>;

export const meta = {
  type: "speedrun",
  label: "Speedrun.com",
  icon: "⏱️",
  category: "gaming",
  description: "Your personal bests and leaderboard places",
  schema,
  defaults: { username: "", sort: "place", limit: 5, levels: false },
} satisfies WidgetMeta;
