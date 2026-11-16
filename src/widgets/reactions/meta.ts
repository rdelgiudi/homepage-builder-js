import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";
import { DEFAULT_EMOJIS } from "@/lib/reactions";

export const schema = z.object({
  ...base("reactions"),
  ...titleFields,
  ...frameField,
  emojis: z.array(z.string()).optional().meta({ title: "Emojis", ui: "emoji-list", description: "Leave empty for the default set" }),
});
export type ReactionsSection = z.infer<typeof schema>;

export const meta = {
  type: "reactions",
  label: "Reactions",
  icon: "✨",
  category: "community",
  description: "Anonymous emoji reactions",
  schema,
  defaults: { emojis: DEFAULT_EMOJIS },
} satisfies WidgetMeta;
