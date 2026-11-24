import { z } from "zod";
import { base, iconField, alignField, invertDarkField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("text"),
  content: z.string().meta({ translate: true, title: "Text", ui: "textarea" }),
  icon: iconField,
  align: alignField,
  invertDark: invertDarkField,
});
export type TextSection = z.infer<typeof schema>;

export const meta = {
  type: "text",
  label: "Text",
  icon: "💬",
  category: "content",
  description: "A paragraph with an optional icon",
  schema,
  defaults: { content: "Some text" },
} satisfies WidgetMeta;
