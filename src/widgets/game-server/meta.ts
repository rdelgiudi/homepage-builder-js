import { z } from "zod";
import { base, titleFields, frameField, iconField } from "../fields";
import type { WidgetMeta } from "../types";

export const serverSchema = z.object({
  label: z.string().meta({ title: "Name" }),
  protocol: z
    .enum(["minecraft", "bedrock", "source"])
    .default("minecraft")
    .meta({ title: "Game", description: "Source = Steam server query (CS2, TF2, Garry's Mod, Rust, Valheim, ARK…)" }),
  address: z.string().meta({
    title: "Address",
    description: "host or host:port. For Source games use the query port (often the game port; some games, e.g. Valheim, use game port + 1). Visible in the page source to every visitor",
  }),
  icon: iconField,
});

export const schema = z.object({
  ...base("game-server"),
  ...titleFields,
  ...frameField,
  servers: z.array(serverSchema).max(10).default([]).meta({ title: "Servers", description: "Checked at most once a minute, only while someone is viewing" }),
  showPlayers: z.boolean().default(true).meta({ title: "Show player names", description: "When the server shares them (Minecraft)" }),
  showAddress: z.boolean().default(true).meta({ title: "Show the address", description: "With a copy button, so visitors can join. Turn off when the query port isn't the one players connect to" }),
});

export type GameServerSection = z.infer<typeof schema>;

export const meta = {
  type: "game-server",
  label: "Game server",
  icon: "🖥️",
  category: "gaming",
  description: "Online status and players for Minecraft and Steam game servers",
  schema,
  defaults: { servers: [{ label: "Minecraft", protocol: "minecraft", address: "play.example.com" }], showPlayers: true, showAddress: true },
} satisfies WidgetMeta;
