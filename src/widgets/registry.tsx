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
import { view as image } from "./image/render";
import { view as embed } from "./embed/render";
import { view as clock } from "./clock/render";
import { view as countdown } from "./countdown/render";
import { view as weather } from "./weather/render";
import { view as rss } from "./rss/render";
import { view as githubActivity } from "./github-activity/render";
import { view as mastodon } from "./mastodon/render";
import { view as bluesky } from "./bluesky/render";
import { view as chess } from "./chess/render";
import { view as skills } from "./skills/render";
import { view as timeline } from "./timeline/render";
import { view as quote } from "./quote/render";
import { view as divider } from "./divider/render";
import { view as poll } from "./poll/render";
import { view as faq } from "./faq/render";
import { view as support } from "./support/render";
import { view as now } from "./now/render";
import { view as buttons } from "./buttons/render";
import { view as youtube } from "./youtube/render";
import { view as twitch } from "./twitch/render";
import { view as music } from "./music/render";
import { view as status } from "./status/render";
import { view as contact } from "./contact/render";
import { view as speedrun } from "./speedrun/render";
import { view as tetrio } from "./tetrio/render";
import { view as gameServer } from "./game-server/render";
import { view as steamRare } from "./steam-rare/render";
import { view as playHistory } from "./play-history/render";
import { view as gameShelf } from "./game-shelf/render";
import { view as playWithMe } from "./play-with-me/render";
import { view as gameSuggest } from "./game-suggest/render";
import { view as profile } from "./profile/render";
import { view as socials } from "./socials/render";
import { view as projects } from "./projects/render";
import { view as notice } from "./notice/render";
import { view as schedule } from "./schedule/render";
import { view as media } from "./media/render";
import { view as stats } from "./stats/render";
import { view as posts } from "./posts/render";

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
  image,
  embed,
  clock,
  countdown,
  weather,
  rss,
  "github-activity": githubActivity,
  mastodon,
  bluesky,
  chess,
  skills,
  timeline,
  quote,
  divider,
  poll,
  faq,
  support,
  now,
  buttons,
  youtube,
  twitch,
  music,
  status,
  contact,
  speedrun,
  tetrio,
  "game-server": gameServer,
  "steam-rare": steamRare,
  "play-history": playHistory,
  "game-shelf": gameShelf,
  "play-with-me": playWithMe,
  "game-suggest": gameSuggest,
  profile,
  socials,
  projects,
  notice,
  schedule,
  media,
  stats,
  posts,
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
      {view.titled && "text" in section && <SectionTitle icon={section.icon} text={section.text} align={section.align} invertDark={section.invertDark} type={section.type} />}
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
