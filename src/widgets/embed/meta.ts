import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("embed"),
  ...titleFields,
  ...frameField,
  url: z.string().default("").meta({ title: "Link", description: "A YouTube, Vimeo, Spotify or SoundCloud link, as copied from the address bar or the Share menu" }),
});

export type EmbedSection = z.infer<typeof schema>;

export const meta = {
  type: "embed",
  label: "Embed",
  icon: "▶️",
  category: "media",
  description: "A YouTube or Vimeo video, or a Spotify or SoundCloud player",
  schema,
  defaults: { url: "" },
} satisfies WidgetMeta;
