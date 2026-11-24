import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const projectItemSchema = z.object({
  title: z.string().meta({ translate: "name", title: "Title" }),
  description: z.string().optional().meta({ translate: true, title: "Description", ui: "textarea" }),
  image: z.string().optional().meta({ title: "Image", ui: "image", description: "Upload or http(s) URL. Shown 16:9" }),
  url: z.string().optional().meta({ title: "Link", description: "Where the card leads (http(s))" }),
  linkLabel: z.string().optional().meta({ translate: true, title: "Link text", description: "Empty = the link's site name" }),
  source: z.string().optional().meta({ title: "Source code link", description: "Optional second link, shown as “Source”" }),
  tags: z.array(z.string()).default([]).meta({ translate: "name", title: "Tags", description: "Tools, engine, language…" }),
  status: z.enum(["active", "finished", "paused", "archived"]).optional().meta({ title: "Status" }),
  year: z.string().optional().meta({ translate: "name", title: "Year", description: "Or a range, e.g. 2022–2024" }),
});

export const schema = z.object({
  ...base("projects"),
  ...titleFields,
  ...frameField,
  items: z.array(projectItemSchema).max(40).default([]).meta({ title: "Projects" }),
  layout: z.enum(["cards", "list"]).default("cards").meta({ title: "Layout", description: "Cards = image on top, in columns. List = one per row, image on the side" }),
  columns: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(2)
    .meta({ title: "Columns", description: "On wide screens (one on phones)", showIf: { layout: ["cards"] } }),
});

export type ProjectsSection = z.infer<typeof schema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;

export const meta = {
  type: "projects",
  label: "Projects",
  icon: "🧩",
  category: "content",
  description: "Portfolio cards with image, description, tags and links — for anything, not only GitHub repos",
  schema,
  defaults: { items: [{ title: "My project", description: "What it is and why it's cool.", tags: [] }], layout: "cards", columns: 2 },
} satisfies WidgetMeta;
