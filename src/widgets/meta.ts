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
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionType = Section["type"];

/** Palette order. */
export const widgetMetas: WidgetMeta[] = [
  header.meta,
  text.meta,
  markdown.meta,
  links.meta,
  github.meta,
  discordUser.meta,
  discordServer.meta,
  steam.meta,
  overwatch.meta,
  meme.meta,
  comments.meta,
  reactions.meta,
];

export const widgetMetaByType: Record<string, WidgetMeta> = Object.fromEntries(widgetMetas.map((m) => [m.type, m]));
