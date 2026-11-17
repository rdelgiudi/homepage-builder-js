import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("bluesky"),
  ...titleFields,
  ...frameField,
  handle: z.string().default("").meta({ title: "Handle", description: "For example name.bsky.social, without the @" }),
  limit: z.number().int().min(1).max(10).default(3).meta({ title: "Posts shown" }),
});

export type BlueskySection = z.infer<typeof schema>;

export const meta = {
  type: "bluesky",
  label: "Bluesky",
  icon: "🦋",
  category: "social",
  description: "Latest posts from a Bluesky account",
  schema,
  defaults: { handle: "", limit: 3 },
} satisfies WidgetMeta;
