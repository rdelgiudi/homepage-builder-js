import { z } from "zod";
import { base, titleFields, frameField, iconField } from "../fields";
import type { WidgetMeta } from "../types";

export const nowItemSchema = z.object({
  icon: iconField,
  label: z.string().meta({ translate: true, title: "Label", description: "For example: Working on, Reading, Playing" }),
  text: z.string().default("").meta({ translate: true, title: "What" }),
  url: z.string().optional().meta({ title: "Link", description: "Optional http(s) link for the text" }),
});

export const schema = z.object({
  ...base("now"),
  ...titleFields,
  ...frameField,
  items: z.array(nowItemSchema).default([]).meta({ title: "Lines" }),
  updated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
    .optional()
    .meta({ title: "Last updated", ui: "date", description: "Shown as “Updated 3 days ago”. Empty = not shown" }),
});

export type NowSection = z.infer<typeof schema>;

export const meta = {
  type: "now",
  label: "Now",
  icon: "📍",
  category: "content",
  description: "What you are doing at the moment, with when you last updated it",
  schema,
  defaults: {
    items: [
      { icon: "🛠️", label: "Working on", text: "This website" },
      { icon: "📚", label: "Reading", text: "" },
    ],
  },
} satisfies WidgetMeta;
