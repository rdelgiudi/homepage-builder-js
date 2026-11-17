import { z } from "zod";
import { base, titleFields } from "../fields";
import type { WidgetMeta } from "../types";

export const buttonItemSchema = z.object({
  image: z.string().meta({ title: "Image", ui: "image", description: "An 88×31 button. Uploaded GIFs keep their animation" }),
  label: z.string().default("").meta({ title: "Name", description: "Read out by screen readers and shown on hover" }),
  url: z.string().optional().meta({ title: "Link", description: "Where the button leads (http/https)" }),
});

export const schema = z.object({
  ...base("buttons"),
  ...titleFields,
  items: z.array(buttonItemSchema).default([]).meta({ title: "Buttons" }),
  pixelated: z.boolean().default(true).meta({ title: "Crisp pixels", description: "Keep pixel art sharp instead of smoothing it" }),
  ringName: z.string().optional().meta({ title: "Webring name", description: "Leave the webring fields empty to show only the buttons" }),
  ringHome: z.string().optional().meta({ title: "Webring home page" }),
  ringPrev: z.string().optional().meta({ title: "Previous site link" }),
  ringNext: z.string().optional().meta({ title: "Next site link" }),
  ringRandom: z.string().optional().meta({ title: "Random site link" }),
});

export type ButtonsSection = z.infer<typeof schema>;

export const meta = {
  type: "buttons",
  label: "Buttons & webring",
  icon: "🔘",
  category: "social",
  description: "A wall of 88×31 buttons, with optional webring navigation",
  schema,
  defaults: { items: [], pixelated: true },
} satisfies WidgetMeta;
