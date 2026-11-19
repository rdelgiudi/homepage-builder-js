import SteamStatus from "@/components/SteamStatus";
import type { WidgetView } from "../types";
import { progressStyle } from "../progress";
import type { SteamSection } from "./meta";

export const view: WidgetView<SteamSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => {
    const progress = progressStyle(section, ctx);
    return (
      <SteamStatus
        enableGradientBorders={ctx.gradientBorders}
        showRecent={section.showRecent}
        showTop={section.showTop}
        progressColors={progress.colors}
        progressAnimate={progress.animate}
      />
    );
  },
};
