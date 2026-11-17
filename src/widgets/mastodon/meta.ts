import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("mastodon"),
  ...titleFields,
  ...frameField,
  instance: z.string().default("").meta({ title: "Server", description: "For example mastodon.social" }),
  account: z.string().default("").meta({ title: "Account name", description: "Without the @ and without the server" }),
  limit: z.number().int().min(1).max(10).default(3).meta({ title: "Posts shown" }),
});

export type MastodonSection = z.infer<typeof schema>;

export const meta = {
  type: "mastodon",
  label: "Mastodon",
  icon: "🐘",
  category: "social",
  description: "Latest posts from a Mastodon account",
  schema,
  defaults: { instance: "", account: "", limit: 3 },
} satisfies WidgetMeta;
