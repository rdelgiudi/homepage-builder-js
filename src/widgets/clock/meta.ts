import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("clock"),
  ...titleFields,
  ...frameField,
  timezone: z.string().default("UTC").meta({ title: "Time zone", ui: "timezone" }),
  place: z.string().optional().meta({ translate: "name", title: "Place name", description: "Shown next to the time. Empty = the time zone's city" }),
  hour12: z.boolean().default(false).meta({ title: "12-hour clock" }),
  showDate: z.boolean().default(true).meta({ title: "Show the date" }),
  showDifference: z.boolean().default(true).meta({ title: "Show the difference to the visitor's time" }),
});

export type ClockSection = z.infer<typeof schema>;

export const meta = {
  type: "clock",
  label: "Clock",
  icon: "🕒",
  category: "info",
  description: "The current time in a time zone you choose",
  schema,
  defaults: { timezone: "Europe/Rome", showDate: true, showDifference: true },
} satisfies WidgetMeta;
