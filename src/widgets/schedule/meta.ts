import { z } from "zod";
import { base, titleFields, frameField, iconField } from "../fields";
import type { WidgetMeta } from "../types";
import { WEEKDAYS } from "./occurrences";

export const slotSchema = z.object({
  label: z.string().meta({ title: "What", description: "For example: Speedrun practice, Community game night" }),
  icon: iconField,
  days: z
    .array(z.enum(WEEKDAYS))
    .default([])
    .meta({ title: "Days", labels: { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" } }),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:mm")
    .default("20:00")
    .meta({ title: "Start time", ui: "time", description: "In the widget's time zone" }),
  duration: z.number().int().min(0).max(1440).default(120).meta({ title: "Length (minutes)", description: "0 = no end time. With a length it shows “Live now” while it runs" }),
  url: z.string().optional().meta({ title: "Link", description: "Optional http(s) link, e.g. your stream" }),
});

export const schema = z.object({
  ...base("schedule"),
  ...titleFields,
  ...frameField,
  timezone: z.string().default("UTC").meta({ title: "Your time zone", ui: "timezone", description: "The times above are in this zone; visitors see them in their own" }),
  items: z.array(slotSchema).max(30).default([]).meta({ title: "Slots" }),
  note: z.string().optional().meta({ title: "Note", description: "Small line under the schedule, e.g. “Times may change — check Discord”" }),
});

export type ScheduleSection = z.infer<typeof schema>;

export const meta = {
  type: "schedule",
  label: "Schedule",
  icon: "🗓️",
  category: "info",
  description: "Weekly recurring times (streams, game nights) shown in each visitor's own time zone",
  schema,
  defaults: { timezone: "UTC", items: [{ label: "Stream", days: ["tue", "thu"], time: "20:00", duration: 120 }] },
} satisfies WidgetMeta;
