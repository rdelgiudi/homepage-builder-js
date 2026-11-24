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
  note: z.string().optional().meta({ translate: true, title: "Note", ui: "textarea" }),
  group: z
    .string()
    .optional()
    .meta({ translate: true, title: "Group", description: "Any name. Used when the shelf's Group is Custom; games with the same name share a row" }),
});

export const schema = z.object({
  ...base("game-shelf"),
  ...titleFields,
  ...frameField,
  items: z.array(shelfItemSchema).max(60).default([]).meta({ title: "Games" }),
  layout: z.enum(["covers", "list"]).default("covers").meta({ title: "Layout" }),
  columns: z.number().int().min(2).max(6).default(4).meta({ title: "Columns", description: "Covers layout, on wide screens" }),
  groupBy: z
    .enum(["none", "status", "custom"])
    .default("none")
    .meta({
      title: "Group",
      description: "Status = Favourites, Currently playing, Finished, Backlog, Dropped. Custom = by each game's own Group name",
    }),
  groupStyle: z
    .enum(["line", "wrap"])
    .default("line")
    .meta({
      title: "Group style",
      description: "Line = each group in one row that scrolls sideways. Wrap = each group's games wrap onto several rows",
      showIf: { groupBy: ["status", "custom"] },
    }),
  groupOrder: z
    .array(z.string())
    .default([])
    .meta({
      translate: true,
      translateAs: "items.group",
      title: "Group order",
      description: "Custom groups listed here come first, in this order; the rest follow in the order they first appear. Games without a group go last, under \"Other\"",
      showIf: { groupBy: ["custom"] },
    }),
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
    groupBy: "none",
    groupStyle: "line",
  },
} satisfies WidgetMeta;
