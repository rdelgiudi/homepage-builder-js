import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { SocialsSection } from "./meta";
import { SocialLinks } from "./SocialLinks";
import { resolveSocials } from "./platforms";

export const view: WidgetView<SocialsSection> = {
  titled: true,
  frame: "none",
  render: (section, ctx) => {
    if (!resolveSocials(section.items).length) return <Notice>Add a profile link in this widget&apos;s settings.</Notice>;
    return <SocialLinks items={section.items} style={section.style} colors={section.colors} size={section.size} align={section.align} gradientBorders={ctx.gradientBorders} />;
  },
};
