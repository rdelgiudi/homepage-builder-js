import { z } from "zod";
import { base, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const quoteItemSchema = z.object({
  text: z.string().meta({ translate: true, title: "Quote", ui: "textarea" }),
  author: z.string().optional().meta({ translate: "name", title: "Who said it" }),
});

export const schema = z.object({
  ...base("quote"),
  ...frameField,
  quotes: z.array(quoteItemSchema).default([]).meta({ title: "Quotes" }),
});

export type QuoteSection = z.infer<typeof schema>;

export const meta = {
  type: "quote",
  label: "Quote",
  icon: "❝",
  category: "content",
  description: "A quote; with several, visitors see a random one",
  schema,
  defaults: { quotes: [{ text: "A quote worth sharing." }] },
} satisfies WidgetMeta;
