import { z } from "zod";
import { base, titleFields } from "../fields";
import type { WidgetMeta } from "../types";
import { SUPPORT_PLATFORMS } from "./platforms";

export const supportItemSchema = z.object({
  platform: z.enum(SUPPORT_PLATFORMS).meta({ title: "Platform" }),
  username: z.string().meta({ title: "Username", description: "Your name on that platform (a link to your page works too)" }),
  label: z.string().optional().meta({ translate: true, title: "Button text", description: "Empty = the platform's usual wording" }),
});

export const schema = z.object({
  ...base("support"),
  ...titleFields,
  items: z.array(supportItemSchema).default([]).meta({ title: "Buttons" }),
});

export type SupportSection = z.infer<typeof schema>;

export const meta = {
  type: "support",
  label: "Support me",
  icon: "💖",
  category: "social",
  description: "Ko-fi, GitHub Sponsors, Patreon and similar buttons in their brand colours",
  schema,
  defaults: { items: [{ platform: "kofi", username: "" }] },
} satisfies WidgetMeta;
