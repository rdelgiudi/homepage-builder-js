/**
 * Social platforms for the `socials` and `profile` widgets: brand colour, icon and the hosts
 * used to recognise a pasted link. Plain .ts (no JSX) so the unit tests can import it.
 * Icons are Simple Icons path data (CC0); a few brands Simple Icons doesn't ship get a
 * short text badge (`glyph`) in their colour instead.
 */
import {
  siAnilist, siArtstation, siBandcamp, siBattledotnet, siBehance, siBluesky, siBuymeacoffee, siChessdotcom, siCodeberg, siCurseforge,
  siDeviantart, siDevdotto, siDiscord, siDribbble, siEpicgames, siFacebook, siFigma, siGithub, siGitlab, siGoodreads, siInstagram,
  siItchdotio, siKick, siKofi, siLastdotfm, siLetterboxd, siLichess, siLinktree, siMastodon, siMatrix, siMedium, siModrinth,
  siMyanimelist, siOsu, siPatreon, siPaypal, siPinterest, siPixiv, siPlaystation, siReddit, siRoblox, siRss, siSignal, siSoundcloud,
  siSpotify, siStackoverflow, siSteam, siSubstack, siTelegram, siThreads, siTiktok, siTrakt, siTumblr, siTwitch, siWhatsapp, siX, siYoutube,
} from "simple-icons";

interface SimpleIcon {
  title: string;
  hex: string;
  path: string;
}

export interface SocialPlatform {
  name: string;
  /** Brand colour, without `#`. */
  hex: string;
  /** SVG path on a 24×24 grid, or null → `glyph` / a generic icon. */
  path: string | null;
  glyph?: string;
  /** Hosts (and their subdomains) that identify the platform from a link. */
  hosts: string[];
}

const brand = (icon: SimpleIcon, hosts: string[], name = icon.title): SocialPlatform => ({ name, hex: icon.hex, path: icon.path, hosts });

export const PLATFORMS = {
  github: brand(siGithub, ["github.com"]),
  gitlab: brand(siGitlab, ["gitlab.com"]),
  codeberg: brand(siCodeberg, ["codeberg.org"]),
  discord: brand(siDiscord, ["discord.gg", "discord.com", "discordapp.com"]),
  steam: brand(siSteam, ["steamcommunity.com", "steampowered.com"]),
  twitch: brand(siTwitch, ["twitch.tv"]),
  youtube: brand(siYoutube, ["youtube.com", "youtu.be"]),
  kick: brand(siKick, ["kick.com"]),
  x: brand(siX, ["x.com", "twitter.com"], "X (Twitter)"),
  bluesky: brand(siBluesky, ["bsky.app"]),
  mastodon: brand(siMastodon, []),
  threads: brand(siThreads, ["threads.net", "threads.com"]),
  instagram: brand(siInstagram, ["instagram.com"]),
  facebook: brand(siFacebook, ["facebook.com", "fb.com"]),
  tiktok: brand(siTiktok, ["tiktok.com"]),
  reddit: brand(siReddit, ["reddit.com"]),
  linkedin: { name: "LinkedIn", hex: "0A66C2", path: null, glyph: "in", hosts: ["linkedin.com"] },
  tumblr: brand(siTumblr, ["tumblr.com"]),
  pinterest: brand(siPinterest, ["pinterest.com"]),
  spotify: brand(siSpotify, ["spotify.com"]),
  soundcloud: brand(siSoundcloud, ["soundcloud.com"]),
  bandcamp: brand(siBandcamp, ["bandcamp.com"]),
  lastfm: brand(siLastdotfm, ["last.fm"]),
  letterboxd: brand(siLetterboxd, ["letterboxd.com", "boxd.it"]),
  anilist: brand(siAnilist, ["anilist.co"]),
  myanimelist: brand(siMyanimelist, ["myanimelist.net"]),
  goodreads: brand(siGoodreads, ["goodreads.com"]),
  trakt: brand(siTrakt, ["trakt.tv"]),
  itchio: brand(siItchdotio, ["itch.io"]),
  epicgames: brand(siEpicgames, ["epicgames.com"]),
  playstation: brand(siPlaystation, ["playstation.com"]),
  xbox: { name: "Xbox", hex: "107C10", path: null, glyph: "X", hosts: ["xbox.com"] },
  battlenet: brand(siBattledotnet, ["battle.net"]),
  roblox: brand(siRoblox, ["roblox.com"]),
  osu: brand(siOsu, ["osu.ppy.sh"]),
  modrinth: brand(siModrinth, ["modrinth.com"]),
  curseforge: brand(siCurseforge, ["curseforge.com"]),
  nexusmods: { name: "Nexus Mods", hex: "DA8E35", path: null, glyph: "N", hosts: ["nexusmods.com"] },
  chesscom: brand(siChessdotcom, ["chess.com"]),
  lichess: brand(siLichess, ["lichess.org"]),
  kofi: brand(siKofi, ["ko-fi.com"]),
  patreon: brand(siPatreon, ["patreon.com"]),
  buymeacoffee: brand(siBuymeacoffee, ["buymeacoffee.com"]),
  paypal: brand(siPaypal, ["paypal.me", "paypal.com"]),
  artstation: brand(siArtstation, ["artstation.com"]),
  deviantart: brand(siDeviantart, ["deviantart.com"]),
  pixiv: brand(siPixiv, ["pixiv.net"]),
  behance: brand(siBehance, ["behance.net"]),
  dribbble: brand(siDribbble, ["dribbble.com"]),
  figma: brand(siFigma, ["figma.com"]),
  substack: brand(siSubstack, ["substack.com"]),
  medium: brand(siMedium, ["medium.com"]),
  devto: brand(siDevdotto, ["dev.to"]),
  stackoverflow: brand(siStackoverflow, ["stackoverflow.com"]),
  matrix: brand(siMatrix, ["matrix.to"]),
  telegram: brand(siTelegram, ["t.me", "telegram.me"]),
  signal: brand(siSignal, ["signal.me"]),
  whatsapp: brand(siWhatsapp, ["wa.me", "whatsapp.com"]),
  linktree: brand(siLinktree, ["linktr.ee"]),
  rss: brand(siRss, [], "RSS feed"),
  email: { name: "Email", hex: "6B7280", path: null, hosts: [] },
  website: { name: "Website", hex: "6B7280", path: null, hosts: [] },
} satisfies Record<string, SocialPlatform>;

export type SocialPlatformKey = keyof typeof PLATFORMS;
export const SOCIAL_PLATFORM_KEYS = Object.keys(PLATFORMS) as [SocialPlatformKey, ...SocialPlatformKey[]];

/** The link to put in `href`: http(s) as is, `mailto:` for an e-mail address (with or without the prefix), null otherwise. */
export function socialHref(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const mail = /^(?:mailto:)?([^\s@/:]+@[^\s@/]+\.[^\s@/]+)$/i.exec(v);
  if (mail) return `mailto:${mail[1]}`;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Recognises the platform from a link. Unknown hosts are a website — or Mastodon for a `/@name` profile path. */
export function detectPlatform(href: string): SocialPlatformKey {
  if (href.startsWith("mailto:")) return "email";
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "website";
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of SOCIAL_PLATFORM_KEYS) {
    const hosts: string[] = PLATFORMS[key].hosts;
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return key;
  }
  if (/\/(rss|feed|atom)(\.xml)?\/?$|\.(rss|atom)$/i.test(url.pathname)) return "rss";
  if (/^\/@[A-Za-z0-9_]+\/?$/.test(url.pathname)) return "mastodon";
  return "website";
}

/** Relative luminance (0 = black, 1 = white) of a hex colour without `#`. */
export function luminance(hex: string): number {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white for an icon on the brand colour. White unless the colour is very light (brands are designed for white). */
export function contrastOn(hex: string): "#000000" | "#ffffff" {
  return luminance(hex) > 0.5 ? "#000000" : "#ffffff";
}

export interface ResolvedSocial {
  href: string;
  key: SocialPlatformKey;
  platform: SocialPlatform;
  label: string;
}

/** Config items → links ready to render (invalid links dropped). */
export function resolveSocials(items: { url: string; platform?: SocialPlatformKey | "auto"; label?: string }[]): ResolvedSocial[] {
  return items.flatMap((item) => {
    const href = socialHref(item.url);
    if (!href) return [];
    const key = !item.platform || item.platform === "auto" ? detectPlatform(href) : item.platform;
    const platform: SocialPlatform = PLATFORMS[key];
    return [{ href, key, platform, label: item.label?.trim() || platform.name }];
  });
}
