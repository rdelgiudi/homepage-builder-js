import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("posts"),
  ...titleFields,
  ...frameField,
  limit: z.number().int().min(1).max(50).default(5).meta({ title: "How many" }),
  tag: z.string().optional().meta({ title: "Only with tag", description: "Show only posts that have this tag in their front matter. Empty = all posts" }),
  layout: z.enum(["list", "cards"]).default("list").meta({ title: "Layout" }),
  showSummary: z.boolean().default(true).meta({ title: "Show summary", description: "The post's `summary`, or the start of its text" }),
  showReadingTime: z.boolean().default(true).meta({ title: "Show reading time" }),
});

export type PostsSection = z.infer<typeof schema>;

export const meta = {
  type: "posts",
  label: "Blog posts",
  icon: "✍️",
  category: "content",
  description: "Lists markdown files from src/content/ that have a date in their front matter; each opens as its own page",
  schema,
  defaults: { limit: 5, layout: "list", showSummary: true, showReadingTime: true },
} satisfies WidgetMeta;
