import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("rss"),
  ...titleFields,
  ...frameField,
  url: z.string().default("").meta({ title: "Feed address", description: "The link to the RSS or Atom feed, usually ending in /feed or .xml" }),
  limit: z.number().int().min(1).max(15).default(5).meta({ title: "Posts shown" }),
  showDates: z.boolean().default(true).meta({ title: "Show dates" }),
});

export type RssSection = z.infer<typeof schema>;

export const meta = {
  type: "rss",
  label: "Feed",
  icon: "📰",
  category: "info",
  description: "Latest posts from a blog or news feed (RSS or Atom)",
  schema,
  defaults: { url: "", limit: 5, showDates: true },
} satisfies WidgetMeta;
