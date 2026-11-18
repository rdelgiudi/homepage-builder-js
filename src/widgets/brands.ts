/**
 * Widgets that show exactly one outside service, and that service's logo (Simple Icons, in
 * its brand colour). Used by the admin panel instead of the widget's emoji, and on the site
 * as the default title icon. Widgets that span several services (chess, music, media, game
 * servers, embed, support) and services Simple Icons has no logo for (Overwatch, Speedrun.com,
 * TETR.IO, Open-Meteo) keep their emoji. Logos are only used to identify the service; keep
 * them unaltered (brand colour, or the text colour for near-black ones) per brand guidelines.
 */
import { luminance, PLATFORMS, type SocialPlatformKey } from "./socials/platforms";

export const WIDGET_BRANDS: Partial<Record<string, SocialPlatformKey>> = {
  steam: "steam",
  "steam-rare": "steam",
  "game-suggest": "steam",
  "discord-server": "discord",
  "discord-user": "discord",
  twitch: "twitch",
  youtube: "youtube",
  mastodon: "mastodon",
  bluesky: "bluesky",
  github: "github",
  "github-activity": "github",
  meme: "reddit",
  rss: "rss",
};

export interface BrandMark {
  name: string;
  path: string;
  /** CSS colour: the brand colour, or `currentColor` for near-black logos (Steam, GitHub) so they stay visible in dark mode. */
  color: string;
}

/** The logo for a widget type, or null when it keeps its emoji. */
export function widgetBrand(type: string): BrandMark | null {
  const key = WIDGET_BRANDS[type];
  if (!key) return null;
  const p = PLATFORMS[key];
  if (!p.path) return null;
  return { name: p.name, path: p.path, color: luminance(p.hex) < 0.03 ? "currentColor" : `#${p.hex}` };
}
