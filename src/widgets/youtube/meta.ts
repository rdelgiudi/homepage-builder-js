import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("youtube"),
  ...titleFields,
  ...frameField,
  channel: z.string().default("").meta({ title: "Channel", description: "Your @handle, or the channel id (starts with UC)" }),
  limit: z.number().int().min(1).max(12).default(4).meta({ title: "Videos shown" }),
  hideShorts: z.boolean().default(true).meta({ title: "Leave out Shorts" }),
  layout: z.enum(["grid", "list"]).default("grid").meta({ title: "Layout" }),
});

export type YouTubeSection = z.infer<typeof schema>;

export const meta = {
  type: "youtube",
  label: "YouTube videos",
  icon: "▶️",
  category: "media",
  description: "Your channel's latest uploads (no API key needed)",
  schema,
  defaults: { channel: "", limit: 4, hideShorts: true, layout: "grid" },
} satisfies WidgetMeta;
