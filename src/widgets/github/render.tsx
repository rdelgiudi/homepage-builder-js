import GitHubProjects from "@/components/GitHubProjects";
import type { WidgetView } from "../types";
import type { GitHubSection } from "./meta";

export const view: WidgetView<GitHubSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <GitHubProjects repos={section.repos} enableGradientBorders={ctx.gradientBorders} />,
};
