import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("tetrio"),
  ...titleFields,
  ...frameField,
  username: z.string().default("").meta({ title: "TETR.IO username" }),
  showRecords: z.boolean().default(true).meta({ title: "Show records", description: "40 Lines, Blitz and Quick Play" }),
});

export type TetrioSection = z.infer<typeof schema>;

export const meta = {
  type: "tetrio",
  label: "TETR.IO",
  icon: "🧱",
  category: "gaming",
  description: "Tetra League rank and your best records",
  schema,
  defaults: { username: "", showRecords: true },
} satisfies WidgetMeta;
