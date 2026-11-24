import { z } from "zod";
import { base, iconField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("notice"),
  tone: z.enum(["info", "success", "warning", "danger", "neutral"]).default("info").meta({ title: "Colour" }),
  icon: iconField.meta({ title: "Icon", ui: "icon", description: "Emoji or image URL. Empty = the colour's own symbol" }),
  title: z.string().optional().meta({ translate: "labels", title: "Heading" }),
  message: z.string().default("").meta({ translate: "labels", title: "Text", ui: "textarea" }),
  linkText: z.string().optional().meta({ translate: true, title: "Link text" }),
  linkUrl: z.string().optional().meta({ title: "Link", description: "http(s). Shown after the text" }),
  until: z
    .string()
    .optional()
    .meta({ title: "Hide after", ui: "datetime", description: "The notice disappears on its own at this time (in the time zone below). Empty = always shown" }),
  timezone: z.string().default("UTC").meta({ title: "Time zone", ui: "timezone" }),
  dismissible: z.boolean().default(false).meta({ title: "Visitors can close it", description: "Remembered in the visitor's browser until the text changes" }),
});

export type NoticeSection = z.infer<typeof schema>;

export const meta = {
  type: "notice",
  label: "Notice",
  icon: "📢",
  category: "content",
  description: "Coloured banner for announcements — away, maintenance, news — that can hide itself after a date",
  schema,
  defaults: { tone: "info", message: "Away until the 25th — replies will be slow.", timezone: "UTC", dismissible: false },
} satisfies WidgetMeta;
