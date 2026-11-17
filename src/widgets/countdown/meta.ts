import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("countdown"),
  ...titleFields,
  ...frameField,
  target: z.string().default("").meta({ title: "Date and time", ui: "datetime", description: "In the time zone below" }),
  timezone: z.string().default("UTC").meta({ title: "Time zone", ui: "timezone" }),
  label: z.string().optional().meta({ title: "What is being counted down to" }),
  doneText: z.string().default("It is time!").meta({ title: "Text once the date has passed" }),
});

export type CountdownSection = z.infer<typeof schema>;

export const meta = {
  type: "countdown",
  label: "Countdown",
  icon: "⏳",
  category: "info",
  description: "Days, hours and minutes until a date",
  schema,
  defaults: { target: "", doneText: "It is time!" },
} satisfies WidgetMeta;
