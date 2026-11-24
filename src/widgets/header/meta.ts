import { z } from "zod";
import { base, iconField, alignField, invertDarkField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("header"),
  title: z.string().meta({ translate: true, title: "Title" }),
  icon: iconField,
  align: alignField,
  invertDark: invertDarkField,
});
export type HeaderSection = z.infer<typeof schema>;

export const meta = {
  type: "header",
  label: "Header",
  icon: "🔠",
  category: "content",
  description: "Big title with an optional icon",
  schema,
  defaults: { title: "New header" },
} satisfies WidgetMeta;
