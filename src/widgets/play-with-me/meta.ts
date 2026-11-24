import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("play-with-me"),
  ...titleFields,
  ...frameField,
  availability: z
    .enum(["auto", "open", "busy"])
    .default("auto")
    .meta({ title: "Availability", description: "Auto = from your Discord and Steam status. Open / Busy = always say so" }),
  note: z.string().optional().meta({ translate: true, title: "Note", ui: "textarea", description: "e.g. \"Up for co-op most evenings, message me on Discord\"" }),
  games: z.array(z.string()).default([]).meta({ title: "Games I play with others" }),
  showSteam: z.boolean().default(true).meta({ title: "\"Add on Steam\" button", description: "Needs STEAM_ID" }),
  showDiscord: z.boolean().default(true).meta({ title: "\"Message on Discord\" button", description: "Needs DISCORD_USER_ID" }),
  joinLink: z
    .boolean()
    .default(false)
    .meta({ title: "\"Join game\" button", description: "When Steam reports a joinable lobby. Anyone on the page can use it" }),
});

export type PlayWithMeSection = z.infer<typeof schema>;

export const meta = {
  type: "play-with-me",
  label: "Play with me",
  icon: "🤝",
  category: "gaming",
  description: "Whether you're up for a game right now, and how to join you",
  schema,
  optionalEnv: [
    { name: "DISCORD_USER_ID", note: "Discord status (with DISCORD_BOT_TOKEN)." },
    { name: "DISCORD_BOT_TOKEN", note: "Discord status (with DISCORD_USER_ID)." },
    { name: "STEAM_API_KEY", note: "Steam status (with STEAM_ID). Needs Discord or Steam." },
    { name: "STEAM_ID", note: "Steam status (with STEAM_API_KEY)." },
  ],
  defaults: { availability: "auto", note: "Up for co-op most evenings. Add me!", games: [], showSteam: true, showDiscord: true, joinLink: false },
} satisfies WidgetMeta;
