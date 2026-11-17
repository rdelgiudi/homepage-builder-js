import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const shelfItemSchema = z.object({
  title: z.string().meta({ title: "Game" }),
  appid: z
    .number()
    .int()
    .min(1)
    .optional()
    .meta({ title: "Steam app id", description: "The number in the game's store link (store.steampowered.com/app/<id>). Gives a cover and a store link" }),
  image: z.string().optional().meta({ title: "Cover image", ui: "image", description: "Upload or http(s) URL. Overrides the Steam cover. Portrait (2:3) looks best" }),
  url: z.string().optional().meta({ title: "Link", description: "Overrides the Steam store link" }),
  status: z.enum(["playing", "finished", "favourite", "backlog", "dropped"]).optional().meta({ title: "Status" }),
  rating: z.number().int().min(1).max(5).optional().meta({ title: "Rating", description: "1–5 stars" }),
  note: z.string().optional().meta({ title: "Note", ui: "textarea" }),
});

export const schema = z.object({
  ...base("game-shelf"),
  ...titleFields,
  ...frameField,
  items: z.array(shelfItemSchema).max(60).default([]).meta({ title: "Games" }),
  layout: z.enum(["covers", "list"]).default("covers").meta({ title: "Layout" }),
  columns: z.number().int().min(2).max(6).default(4).meta({ title: "Columns", description: "Covers layout, on wide screens" }),
});

export type GameShelfSection = z.infer<typeof schema>;
export type ShelfItem = z.infer<typeof shelfItemSchema>;

export const meta = {
  type: "game-shelf",
  label: "Game shelf",
  icon: "🎮",
  category: "gaming",
  description: "Favourite, current and finished games with covers, ratings and notes",
  schema,
  defaults: {
    items: [
      { title: "Hollow Knight", appid: 367520, status: "finished", rating: 5 },
      { title: "Hades", appid: 1145360, status: "favourite", rating: 5 },
    ],
    layout: "covers",
    columns: 4,
  },
} satisfies WidgetMeta;
