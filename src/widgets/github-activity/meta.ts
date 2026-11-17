import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("github-activity"),
  ...titleFields,
  ...frameField,
  username: z.string().default("").meta({ title: "GitHub username" }),
});

export type GitHubActivitySection = z.infer<typeof schema>;

export const meta = {
  type: "github-activity",
  label: "GitHub Activity",
  icon: "🟩",
  category: "social",
  description: "A year of GitHub contributions as a heatmap",
  schema,
  defaults: { username: "" },
} satisfies WidgetMeta;
