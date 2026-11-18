import { z } from "zod";
import { base, titleFields } from "../fields";
import type { WidgetMeta } from "../types";
import { PLATFORMS, SOCIAL_PLATFORM_KEYS } from "./platforms";

export const socialItemSchema = z.object({
  url: z.string().meta({ title: "Link", description: "Profile link (https://…) or an e-mail address" }),
  platform: z
    .enum(["auto", ...SOCIAL_PLATFORM_KEYS])
    .default("auto")
    .meta({
      title: "Platform",
      description: "Auto = recognised from the link",
      labels: { auto: "Auto", ...Object.fromEntries(SOCIAL_PLATFORM_KEYS.map((k) => [k, PLATFORMS[k].name])) },
    }),
  label: z.string().optional().meta({ title: "Label", description: "Tooltip and button text. Empty = the platform's name" }),
});

/** Look of a row of social links — shared with the profile card. */
export const socialStyleFields = {
  style: z.enum(["icons", "buttons"]).default("icons").meta({ title: "Style", description: "Icons = round icon-only buttons. Buttons = icon + label" }),
  colors: z.enum(["brand", "mono"]).default("brand").meta({ title: "Colours", description: "Brand = each platform's own colour. Mono = neutral grey" }),
  size: z.enum(["sm", "md", "lg"]).default("md").meta({ title: "Size" }),
};

export const schema = z.object({
  ...base("socials"),
  ...titleFields,
  items: z.array(socialItemSchema).max(40).default([]).meta({ title: "Links" }),
  ...socialStyleFields,
});

export type SocialsSection = z.infer<typeof schema>;
export type SocialItem = z.infer<typeof socialItemSchema>;

export const meta = {
  type: "socials",
  label: "Social icons",
  icon: "🌐",
  category: "social",
  description: "Compact row of brand-coloured icons for your profiles elsewhere",
  schema,
  defaults: { items: [{ url: "https://github.com/" }], style: "icons", colors: "brand", size: "md" },
} satisfies WidgetMeta;
