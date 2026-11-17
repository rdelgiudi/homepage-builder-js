/**
 * Server-safe widget index: every widget's metadata + the section schema built from them.
 * To add a widget: create `src/widgets/<type>/meta.ts` + `render.tsx`, then register it
 * here and in `registry.tsx`.
 */
import { z } from "zod";
import type { WidgetMeta } from "./types";
import * as header from "./header/meta";
import * as text from "./text/meta";
import * as links from "./links/meta";
import * as discordServer from "./discord-server/meta";
import * as discordUser from "./discord-user/meta";
import * as steam from "./steam/meta";
import * as overwatch from "./overwatch/meta";
import * as markdown from "./markdown/meta";
import * as meme from "./meme/meta";
import * as github from "./github/meta";
import * as comments from "./comments/meta";
import * as reactions from "./reactions/meta";
import * as image from "./image/meta";
import * as embed from "./embed/meta";
import * as clock from "./clock/meta";
import * as countdown from "./countdown/meta";
import * as weather from "./weather/meta";
import * as rss from "./rss/meta";
import * as githubActivity from "./github-activity/meta";
import * as mastodon from "./mastodon/meta";
import * as bluesky from "./bluesky/meta";
import * as chess from "./chess/meta";
import * as skills from "./skills/meta";
import * as timeline from "./timeline/meta";
import * as quote from "./quote/meta";
import * as divider from "./divider/meta";
import * as poll from "./poll/meta";
import * as faq from "./faq/meta";
import * as support from "./support/meta";
import * as now from "./now/meta";
import * as buttons from "./buttons/meta";
import * as youtube from "./youtube/meta";
import * as twitch from "./twitch/meta";
import * as music from "./music/meta";
import * as status from "./status/meta";
import * as contact from "./contact/meta";
import * as speedrun from "./speedrun/meta";
import * as tetrio from "./tetrio/meta";
import * as gameServer from "./game-server/meta";
import * as steamRare from "./steam-rare/meta";
import * as playHistory from "./play-history/meta";
import * as gameShelf from "./game-shelf/meta";
import * as playWithMe from "./play-with-me/meta";
import * as gameSuggest from "./game-suggest/meta";

export const SectionSchema = z.discriminatedUnion("type", [
  header.schema,
  text.schema,
  links.schema,
  discordServer.schema,
  discordUser.schema,
  steam.schema,
  overwatch.schema,
  markdown.schema,
  meme.schema,
  github.schema,
  comments.schema,
  reactions.schema,
  image.schema,
  embed.schema,
  clock.schema,
  countdown.schema,
  weather.schema,
  rss.schema,
  githubActivity.schema,
  mastodon.schema,
  bluesky.schema,
  chess.schema,
  skills.schema,
  timeline.schema,
  quote.schema,
  divider.schema,
  poll.schema,
  faq.schema,
  support.schema,
  now.schema,
  buttons.schema,
  youtube.schema,
  twitch.schema,
  music.schema,
  status.schema,
  contact.schema,
  speedrun.schema,
  tetrio.schema,
  gameServer.schema,
  steamRare.schema,
  playHistory.schema,
  gameShelf.schema,
  playWithMe.schema,
  gameSuggest.schema,
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];

/** Palette order (the admin panel groups these by category, keeping this order within each). */
export const widgetMetas: WidgetMeta[] = [
  // content
  header.meta,
  text.meta,
  markdown.meta,
  quote.meta,
  now.meta,
  faq.meta,
  skills.meta,
  timeline.meta,
  divider.meta,
  // media
  image.meta,
  embed.meta,
  youtube.meta,
  twitch.meta,
  music.meta,
  meme.meta,
  // info
  clock.meta,
  countdown.meta,
  weather.meta,
  rss.meta,
  status.meta,
  // social
  links.meta,
  support.meta,
  buttons.meta,
  github.meta,
  githubActivity.meta,
  mastodon.meta,
  bluesky.meta,
  discordUser.meta,
  discordServer.meta,
  // gaming
  steam.meta,
  overwatch.meta,
  chess.meta,
  playWithMe.meta,
  steamRare.meta,
  playHistory.meta,
  gameShelf.meta,
  speedrun.meta,
  tetrio.meta,
  gameServer.meta,
  // community
  comments.meta,
  reactions.meta,
  poll.meta,
  contact.meta,
  gameSuggest.meta,
];

export const widgetMetaByType: Record<string, WidgetMeta> = Object.fromEntries(widgetMetas.map((m) => [m.type, m]));
