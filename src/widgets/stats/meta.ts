import { z } from "zod";
import { base, titleFields, frameField, iconField } from "../fields";
import type { WidgetMeta } from "../types";

export const statItemSchema = z.object({
  value: z.string().meta({ title: "Value", description: "For example: 2,400 h · 12 years · 98% · #1" }),
  label: z.string().meta({ title: "Label" }),
  icon: iconField,
});

export const schema = z.object({
  ...base("stats"),
  ...titleFields,
  ...frameField,
  items: z.array(statItemSchema).max(24).default([]).meta({ title: "Numbers" }),
  columns: z.number().int().min(2).max(6).default(3).meta({ title: "Per row", description: "On wide screens (two on phones)" }),
  style: z.enum(["cards", "plain"]).default("cards").meta({ title: "Style", description: "Cards = each number on its own tile. Plain = numbers only" }),
  gradient: z.boolean().default(true).meta({ title: "Gradient numbers", description: "Numbers in the title gradient colours" }),
  countUp: z.boolean().default(true).meta({ title: "Count up", description: "Numbers count up when they scroll into view (not for visitors who prefer reduced motion)" }),
});

export type StatsSection = z.infer<typeof schema>;

export const meta = {
  type: "stats",
  label: "Big numbers",
  icon: "🔢",
  category: "content",
  description: "A row of large figures with labels — hours played, years coding, projects shipped",
  schema,
  defaults: {
    items: [
      { value: "2,400 h", label: "in my favourite game" },
      { value: "12", label: "years of coding" },
      { value: "30+", label: "projects" },
    ],
    columns: 3,
    style: "cards",
    gradient: true,
    countUp: true,
  },
} satisfies WidgetMeta;
