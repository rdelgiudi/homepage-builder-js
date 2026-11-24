import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const imageItemSchema = z.object({
  src: z.string().meta({ title: "Image", ui: "image" }),
  alt: z.string().optional().meta({ translate: true, title: "Description", description: "Read aloud by screen readers" }),
  caption: z.string().optional().meta({ translate: true, title: "Caption" }),
  link: z.string().optional().meta({ title: "Link", description: "Opens when the image is clicked. Empty = the image itself" }),
});

export const schema = z.object({
  ...base("image"),
  ...titleFields,
  ...frameField,
  images: z.array(imageItemSchema).default([]).meta({ title: "Images" }),
  columns: z.number().int().min(1).max(4).default(3).meta({ title: "Images per row", description: "At most 2 on phones" }),
  shape: z.enum(["original", "square", "wide"]).default("original").meta({ title: "Shape" }),
});

export type ImageSection = z.infer<typeof schema>;

export const meta = {
  type: "image",
  label: "Images",
  icon: "🖼️",
  category: "media",
  description: "One image or a gallery",
  schema,
  defaults: { images: [], columns: 3 },
} satisfies WidgetMeta;
