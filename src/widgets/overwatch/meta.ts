import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("overwatch"),
  ...titleFields,
  ...frameField,
});
export type OverwatchSection = z.infer<typeof schema>;

export const meta = {
  type: "overwatch",
  label: "Overwatch 2",
  icon: "🎯",
  category: "gaming",
  description: "Overwatch 2 competitive stats",
  schema,
  defaults: {},
  requiresEnv: ["OVERWATCH_BATTLE_TAG"],
} satisfies WidgetMeta;
