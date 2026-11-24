import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";
import { socialItemSchema, socialStyleFields } from "../socials/meta";

export const schema = z.object({
  ...base("profile"),
  ...titleFields,
  ...frameField,
  avatar: z.string().optional().meta({ title: "Picture", ui: "image", description: "Upload or http(s) URL. Square looks best" }),
  avatarShape: z.enum(["circle", "rounded", "square"]).default("circle").meta({ title: "Picture shape" }),
  name: z.string().default("").meta({ translate: "name", title: "Name" }),
  pronouns: z.string().optional().meta({ translate: true, title: "Pronouns", description: "For example: she/her, they/them" }),
  location: z.string().optional().meta({ translate: "name", title: "Location" }),
  bio: z.string().optional().meta({ translate: true, title: "Bio", ui: "textarea", description: "A few lines about you. Line breaks are kept" }),
  layout: z.enum(["centered", "side"]).default("centered").meta({ title: "Layout", description: "Centered = picture above the text. Side = picture on the left (stacks on phones)" }),
  card: z.boolean().default(true).meta({ title: "Card background", description: "Off = sits directly on the page, like the site header" }),
  socials: z.array(socialItemSchema).max(40).default([]).meta({ title: "Social links" }),
  ...socialStyleFields,
});

export type ProfileSection = z.infer<typeof schema>;

export const meta = {
  type: "profile",
  label: "Profile card",
  icon: "🪪",
  category: "social",
  description: "Picture, name, pronouns, location, a short bio and your social links",
  schema,
  defaults: { name: "", avatarShape: "circle", layout: "centered", card: true, socials: [], style: "icons", colors: "brand", size: "md" },
} satisfies WidgetMeta;
