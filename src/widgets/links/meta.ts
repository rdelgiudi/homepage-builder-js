import { z } from "zod";
import { base, titleFields, iconField, invertDarkField } from "../fields";
import type { WidgetMeta } from "../types";

export const linkItemSchema = z.object({
  label: z.string().meta({ title: "Label" }),
  url: z.string().meta({ title: "URL" }),
  icon: iconField,
  style: z.enum(["primary", "secondary"]).optional().meta({ title: "Style" }),
  invertDark: invertDarkField,
});

export const schema = z.object({
  ...base("links"),
  ...titleFields,
  items: z.array(linkItemSchema).default([]).meta({ title: "Links" }),
});
export type LinksSection = z.infer<typeof schema>;

export const meta = {
  type: "links",
  label: "Links",
  icon: "🔗",
  category: "social",
  description: "A row of link cards or buttons",
  schema,
  defaults: { items: [{ label: "Link", url: "https://example.com" }] },
} satisfies WidgetMeta;
