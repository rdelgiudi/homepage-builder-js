import SteamStatus from "@/components/SteamStatus";
import type { WidgetView } from "../types";
import type { SteamSection } from "./meta";

export const view: WidgetView<SteamSection> = {
  titled: true,
  frame: "wrap",
  render: (_section, ctx) => <SteamStatus enableGradientBorders={ctx.gradientBorders} />,
};
