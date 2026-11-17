import { Notice } from "../common";
import { alignClass } from "../shared";
import type { WidgetView } from "../types";
import type { SupportSection } from "./meta";
import { PLATFORMS, supportUrl } from "./platforms";

export const view: WidgetView<SupportSection> = {
  titled: true,
  frame: "none",
  render: (section, ctx) => {
    const buttons = section.items.flatMap((item) => {
      const url = supportUrl(item.platform, item.username);
      return url ? [{ ...item, url, info: PLATFORMS[item.platform] }] : [];
    });
    if (!buttons.length) return <Notice>Add a platform and your username in this widget&apos;s settings.</Notice>;
    return (
      <div className={`flex flex-wrap gap-3 ${alignClass(section.align)}`}>
        {buttons.map((b, i) => (
          <a
            key={i}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            title={b.info.name}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:scale-105 ${b.info.className}${ctx.gradientBorders ? " gradient-border-card" : ""}`}
          >
            <span aria-hidden>{b.info.icon}</span>
            <span>{b.label || b.info.label}</span>
          </a>
        ))}
      </div>
    );
  },
};
