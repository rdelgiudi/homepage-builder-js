import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("chess"),
  ...titleFields,
  ...frameField,
  site: z.enum(["lichess", "chesscom"]).default("lichess").meta({ title: "Site" }),
  username: z.string().default("").meta({ title: "Username" }),
});

export type ChessSection = z.infer<typeof schema>;

export const meta = {
  type: "chess",
  label: "Chess",
  icon: "♟️",
  category: "gaming",
  description: "Ratings from Lichess or Chess.com",
  schema,
  defaults: { site: "lichess", username: "" },
} satisfies WidgetMeta;
