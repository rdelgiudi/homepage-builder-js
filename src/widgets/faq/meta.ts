import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const faqItemSchema = z.object({
  question: z.string().meta({ title: "Question" }),
  answer: z.string().default("").meta({ title: "Answer", ui: "textarea" }),
});

export const schema = z.object({
  ...base("faq"),
  ...titleFields,
  ...frameField,
  items: z.array(faqItemSchema).default([]).meta({ title: "Questions" }),
  openFirst: z.boolean().default(false).meta({ title: "Open the first question", description: "Show the first answer without a click" }),
});

export type FaqSection = z.infer<typeof schema>;

export const meta = {
  type: "faq",
  label: "FAQ",
  icon: "❓",
  category: "content",
  description: "Questions that open to show their answer",
  schema,
  defaults: { items: [{ question: "What is this site?", answer: "My little corner of the internet." }], openFirst: false },
} satisfies WidgetMeta;
