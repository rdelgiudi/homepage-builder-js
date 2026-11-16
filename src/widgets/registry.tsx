/**
 * Client-side widget index: how each section type renders.
 * Imports only types from the meta files, so zod stays out of the client bundle.
 */
import type { ReactNode } from "react";
import type { Section, SectionType } from "./meta";
import type { WidgetContext, WidgetView } from "./types";
import { SectionTitle, WidgetFrame } from "./shared";
import { view as header } from "./header/render";
import { view as text } from "./text/render";
import { view as links } from "./links/render";
import { view as discordServer } from "./discord-server/render";
import { view as discordUser } from "./discord-user/render";
import { view as steam } from "./steam/render";
import { view as overwatch } from "./overwatch/render";
import { view as markdown } from "./markdown/render";
import { view as meme } from "./meme/render";
import { view as github } from "./github/render";
import { view as comments } from "./comments/render";
import { view as reactions } from "./reactions/render";

const views: { [K in SectionType]: WidgetView<Extract<Section, { type: K }>> } = {
  header,
  text,
  links,
  "discord-server": discordServer,
  "discord-user": discordUser,
  steam,
  overwatch,
  markdown,
  meme,
  github,
  comments,
  reactions,
};

/** Renders one section: optional title row, optional gradient frame, then the widget body. */
export function renderSection(section: Section, ctx: WidgetContext): ReactNode {
  const view = views[section.type] as WidgetView<Section> | undefined;
  if (!view) return null;

  const framed = view.frame !== "none" && (("widgetFrame" in section ? section.widgetFrame : undefined) ?? ctx.widgetFrame);
  const body = view.render(section, { ...ctx, framed });

  if (!view.titled && view.frame !== "wrap") return body;

  return (
    <div>
      {view.titled && "text" in section && <SectionTitle icon={section.icon} text={section.text} align={section.align} invertDark={section.invertDark} />}
      {view.frame === "wrap" ? (
        <WidgetFrame enabled={framed} colors={ctx.titleGradient} width={ctx.widgetFrameWidth}>
          {body}
        </WidgetFrame>
      ) : (
        body
      )}
    </div>
  );
}
