import { Card, Notice } from "../common";
import type { WidgetView } from "../types";
import type { EmbedSection } from "./meta";

interface Player {
  src: string;
  title: string;
  /** Fixed height in px, or a 16:9 box when absent. */
  height?: number;
}

/**
 * Turns a link into the address of that site's own embeddable player. Only these four
 * sites are recognised — the iframe never points anywhere else.
 */
export function toPlayer(link: string): Player | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const path = url.pathname.split("/").filter(Boolean);
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]+$/.test(s) ? s : null);

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const video = id(host === "youtu.be" ? path[0] : url.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(path[0]) ? path[1] : null));
    const list = id(url.searchParams.get("list"));
    if (video) return { src: `https://www.youtube-nocookie.com/embed/${video}${list ? `?list=${list}` : ""}`, title: "YouTube video" };
    if (list) return { src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`, title: "YouTube playlist" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const video = path.find((p) => /^\d+$/.test(p));
    if (video) return { src: `https://player.vimeo.com/video/${video}`, title: "Vimeo video" };
  }
  if (host === "open.spotify.com") {
    // Links may carry a locale prefix: /intl-it/track/…
    const parts = path[0]?.startsWith("intl-") ? path.slice(1) : path[0] === "embed" ? path.slice(1) : path;
    const kind = ["track", "album", "playlist", "episode", "show", "artist"].includes(parts[0]) ? parts[0] : null;
    const item = id(parts[1]);
    if (kind && item) return { src: `https://open.spotify.com/embed/${kind}/${item}`, title: "Spotify player", height: kind === "track" || kind === "episode" ? 152 : 352 };
  }
  if (host === "soundcloud.com" && path.length >= 2) {
    const sound = `https://soundcloud.com/${path.map(encodeURIComponent).join("/")}`;
    return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(sound)}&visual=false`, title: "SoundCloud player", height: path[1] === "sets" ? 352 : 166 };
  }
  return null;
}

export const view: WidgetView<EmbedSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => {
    if (!section.url.trim()) return <Card><Notice>Paste a YouTube, Vimeo, Spotify or SoundCloud link in this widget&apos;s settings.</Notice></Card>;
    const player = toPlayer(section.url);
    if (!player) return <Card><Notice>That link can&apos;t be embedded. Use a YouTube, Vimeo, Spotify or SoundCloud link.</Notice></Card>;
    return (
      <div className={`overflow-hidden rounded-lg bg-black/10 dark:bg-black/30${player.height ? "" : " aspect-video"}`} style={player.height ? { height: player.height } : undefined}>
        <iframe
          src={player.src}
          title={player.title}
          className="w-full h-full border-0"
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        />
      </div>
    );
  },
};
