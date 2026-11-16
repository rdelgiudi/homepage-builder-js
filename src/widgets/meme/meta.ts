import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("meme"),
  ...titleFields,
  ...frameField,
  popular: z
    .boolean()
    .optional()
    .meta({ title: "Popular mode", description: "Show the most upvoted memes first instead of a random one" }),
});
export type MemeSection = z.infer<typeof schema>;

export const meta = {
  type: "meme",
  label: "Meme",
  icon: "😂",
  category: "media",
  description: "Random meme (NSFW and spoilers always filtered)",
  schema,
  defaults: { popular: false },
} satisfies WidgetMeta;
