import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("comments"),
  ...titleFields,
  ...frameField,
  limit: z.number().int().min(1).max(200).optional().meta({ title: "Max comments shown", description: "Default 50" }),
});
export type CommentsSection = z.infer<typeof schema>;

export const meta = {
  type: "comments",
  label: "Guestbook",
  icon: "📝",
  category: "community",
  description: "Visitors can leave comments",
  schema,
  defaults: { limit: 50 },
} satisfies WidgetMeta;
