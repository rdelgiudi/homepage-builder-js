import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const timelineItemSchema = z.object({
  title: z.string().meta({ translate: true, title: "Title" }),
  date: z.string().optional().meta({ translate: true, title: "When", description: "Any text: a year, a date, a range" }),
  text: z.string().optional().meta({ translate: true, title: "Details", ui: "textarea" }),
});

export const schema = z.object({
  ...base("timeline"),
  ...titleFields,
  ...frameField,
  items: z.array(timelineItemSchema).default([]).meta({ title: "Events" }),
});

export type TimelineSection = z.infer<typeof schema>;

export const meta = {
  type: "timeline",
  label: "Timeline",
  icon: "🗓️",
  category: "content",
  description: "Events in order, such as jobs or milestones",
  schema,
  defaults: { items: [{ date: "2024", title: "Something happened" }] },
} satisfies WidgetMeta;
