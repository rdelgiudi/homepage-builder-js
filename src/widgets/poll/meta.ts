import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("poll"),
  ...titleFields,
  ...frameField,
  question: z.string().default("").meta({ translate: true, title: "Question" }),
  options: z.array(z.string()).default([]).meta({ translate: "labels", title: "Options", description: "Renaming an option starts its count from zero" }),
  results: z.enum(["after", "always"]).default("after").meta({ title: "Show results", description: "After = only once the visitor has voted" }),
});

export type PollSection = z.infer<typeof schema>;

export const meta = {
  type: "poll",
  label: "Poll",
  icon: "📊",
  category: "community",
  description: "A question visitors can vote on",
  schema,
  defaults: { question: "What should I build next?", options: ["Option one", "Option two"], results: "after" },
} satisfies WidgetMeta;
