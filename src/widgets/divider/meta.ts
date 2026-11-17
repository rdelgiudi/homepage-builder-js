import { z } from "zod";
import { base } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("divider"),
  style: z.enum(["line", "dots", "space"]).default("line").meta({ title: "Style" }),
  size: z.enum(["small", "medium", "large"]).default("medium").meta({ title: "Space around it" }),
});

export type DividerSection = z.infer<typeof schema>;

export const meta = {
  type: "divider",
  label: "Divider",
  icon: "➖",
  category: "content",
  description: "A line or empty space between widgets",
  schema,
  defaults: { style: "line", size: "medium" },
} satisfies WidgetMeta;
