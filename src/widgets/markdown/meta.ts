import { z } from "zod";
import { base, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("markdown"),
  ...frameField,
  file: z.string().meta({ title: "File", description: "Markdown file in src/content/", ui: "content-file" }),
});
export type MarkdownSection = z.infer<typeof schema>;

export const meta = {
  type: "markdown",
  label: "Markdown",
  icon: "📝",
  category: "content",
  description: "Renders a markdown file from src/content/",
  schema,
  defaults: { file: "about.md" },
} satisfies WidgetMeta;
