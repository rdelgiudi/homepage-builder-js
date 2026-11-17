import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const skillItemSchema = z.object({
  label: z.string().meta({ title: "Name" }),
  icon: z.string().optional().meta({ title: "Icon", ui: "icon", description: "Emoji or image URL" }),
  level: z.number().int().min(1).max(5).optional().meta({ title: "Level (1–5)", description: "Empty = no level shown" }),
});

export const schema = z.object({
  ...base("skills"),
  ...titleFields,
  ...frameField,
  items: z.array(skillItemSchema).default([]).meta({ title: "Skills" }),
});

export type SkillsSection = z.infer<typeof schema>;

export const meta = {
  type: "skills",
  label: "Skills",
  icon: "🏷️",
  category: "content",
  description: "A row of badges, each with an optional level",
  schema,
  defaults: { items: [{ label: "TypeScript", level: 4 }] },
} satisfies WidgetMeta;
