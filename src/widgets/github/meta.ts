import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const repoItemSchema = z.object({
  owner: z.string().meta({ title: "Owner" }),
  repo: z.string().meta({ title: "Repository" }),
  label: z.string().optional().meta({ translate: "name", title: "Label" }),
  note: z.string().optional().meta({ translate: true, title: "Note" }),
});

export const schema = z.object({
  ...base("github"),
  ...titleFields,
  ...frameField,
  repos: z.array(repoItemSchema).default([]).meta({ title: "Repositories" }),
});
export type GitHubSection = z.infer<typeof schema>;

export const meta = {
  type: "github",
  label: "GitHub Projects",
  icon: "📂",
  category: "social",
  description: "Cards for GitHub repositories (public API, no key needed)",
  schema,
  defaults: { repos: [] },
} satisfies WidgetMeta;
