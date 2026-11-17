import { Card, Notice } from "../common";
import { toPlayer } from "./player";
import type { WidgetView } from "../types";
import type { EmbedSection } from "./meta";

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
