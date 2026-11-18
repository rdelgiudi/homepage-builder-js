import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("media"),
  ...titleFields,
  ...frameField,
  service: z
    .enum(["anilist", "letterboxd", "openlibrary"])
    .default("anilist")
    .meta({ title: "Service", labels: { anilist: "AniList", letterboxd: "Letterboxd", openlibrary: "Open Library" } }),
  username: z.string().default("").meta({ title: "Username", description: "Your name on that site. Open Library: the reading log must be public" }),
  kind: z.enum(["anime", "manga"]).default("anime").meta({ title: "List", showIf: { service: ["anilist"] } }),
  list: z
    .enum(["current", "finished", "planned"])
    .default("current")
    .meta({
      title: "Show",
      description: "Letterboxd always shows your diary (recently watched)",
      labels: { current: "In progress", finished: "Finished", planned: "Planned" },
      showIf: { service: ["anilist", "openlibrary"] },
    }),
  limit: z.number().int().min(1).max(20).default(6).meta({ title: "How many" }),
  layout: z.enum(["covers", "list"]).default("covers").meta({ title: "Layout" }),
  columns: z.number().int().min(3).max(8).default(6).meta({ title: "Covers per row", description: "On wide screens (three on phones)", showIf: { layout: ["covers"] } }),
  showRatings: z.boolean().default(true).meta({ title: "Show my ratings" }),
});

export type MediaSection = z.infer<typeof schema>;

export const meta = {
  type: "media",
  label: "Watching / reading",
  icon: "🎬",
  category: "media",
  description: "Anime and manga from AniList, films from Letterboxd or books from Open Library — what you're on right now",
  schema,
  defaults: { service: "anilist", username: "", kind: "anime", list: "current", limit: 6, layout: "covers", columns: 6, showRatings: true },
} satisfies WidgetMeta;
