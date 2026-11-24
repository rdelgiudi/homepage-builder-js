import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("game-suggest"),
  ...titleFields,
  ...frameField,
  intro: z.string().optional().meta({ translate: true, title: "Intro text", ui: "textarea", description: "Shown above the search box" }),
  askName: z.boolean().default(true).meta({ title: "Ask for a name", description: "Optional for the visitor" }),
  buttonText: z.string().default("Suggest").meta({ translate: true, title: "Button text" }),
  successText: z.string().default("Thanks! I'll take a look.").meta({ translate: true, title: "After sending" }),
  showList: z
    .boolean()
    .default(false)
    .meta({ title: "Show the most-suggested games", description: "A public top 10 with your status (will play, played). Dismissed games are never shown" }),
});

export type GameSuggestSection = z.infer<typeof schema>;

export const meta = {
  type: "game-suggest",
  label: "Game recommendations",
  icon: "💡",
  category: "community",
  description: "Visitors search Steam and suggest a game for you; read them in the admin panel",
  schema,
  defaults: { intro: "What should I play next? Search for a game on Steam and tell me why.", askName: true, buttonText: "Suggest", successText: "Thanks! I'll take a look.", showList: false },
} satisfies WidgetMeta;
