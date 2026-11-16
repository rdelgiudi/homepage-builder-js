import OverwatchStatus from "@/components/OverwatchStatus";
import type { WidgetView } from "../types";
import type { OverwatchSection } from "./meta";

export const view: WidgetView<OverwatchSection> = {
  titled: true,
  frame: "wrap",
  render: (_section, ctx) => <OverwatchStatus />,
};
