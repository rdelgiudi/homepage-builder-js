import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("music"),
  ...titleFields,
  ...frameField,
  service: z.enum(["listenbrainz", "lastfm"]).default("listenbrainz").meta({ title: "Service", description: "ListenBrainz needs nothing else; Last.fm needs LASTFM_API_KEY on the server" }),
  username: z.string().default("").meta({ title: "Username" }),
  limit: z.number().int().min(1).max(15).default(5).meta({ title: "Tracks shown" }),
  showCovers: z.boolean().default(true).meta({ title: "Show album covers" }),
});

export type MusicSection = z.infer<typeof schema>;

export const meta = {
  type: "music",
  label: "Recently played",
  icon: "🎧",
  category: "media",
  description: "Your latest tracks from ListenBrainz or Last.fm",
  schema,
  optionalEnv: [{ name: "LASTFM_API_KEY", note: "Only for the Last.fm service; ListenBrainz needs nothing." }],
  defaults: { service: "listenbrainz", username: "", limit: 5, showCovers: true },
} satisfies WidgetMeta;
