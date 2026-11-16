import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("steam"),
  ...titleFields,
  ...frameField,
});
export type SteamSection = z.infer<typeof schema>;

export const meta = {
  type: "steam",
  label: "Steam",
  icon: "🎮",
  category: "gaming",
  description: "Steam profile, recent and top games with achievements",
  schema,
  defaults: {},
  requiresEnv: ["STEAM_API_KEY", "STEAM_ID"],
} satisfies WidgetMeta;
