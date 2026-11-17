import { DataCard, Notice, timeAgo, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { MusicSection } from "./meta";

interface History {
  user: string;
  profile: string;
  tracks: { title: string; artist: string; album: string; cover: string | null; url: string | null; date: string | null; nowPlaying: boolean }[];
}

function Equalizer() {
  return (
    <span className="inline-flex items-end gap-px h-3" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="w-0.5 h-full bg-green-500 origin-bottom animate-pulse" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function Music({ section }: { section: MusicSection }) {
  const user = section.username.trim();
  const state = useWidgetData<History>(user ? `/api/widgets/music?id=${encodeURIComponent(section.id)}&u=${encodeURIComponent(`${section.service}:${user}`)}` : null, 2 * 60 * 1000);
  const name = section.service === "lastfm" ? "Last.fm" : "ListenBrainz";
  return (
    <DataCard state={state} setup={!user && `Set your ${name} username in this widget's settings.`} lines={section.limit}>
      {(h) => (
        <div className="text-left">
          {h.tracks.length ? (
            <ul className="space-y-2.5">
              {h.tracks.slice(0, section.limit).map((t, i) => {
                const body = (
                  <>
                    {section.showCovers && (
                      <span className="w-11 h-11 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                        {t.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Cover Art Archive / Last.fm CDN; not next/image hosts
                          <img src={t.cover} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                        ) : (
                          "♪"
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{t.title}</span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{[t.artist, t.album].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {t.nowPlaying ? (
                        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <Equalizer /> now
                        </span>
                      ) : (
                        timeAgo(t.date)
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={`${i}-${t.title}`}>
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:opacity-80">
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-center gap-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Notice>Nothing played yet.</Notice>
          )}
          <a href={h.profile} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-gray-500 dark:text-gray-400 hover:underline">
            {h.user} on {name} →
          </a>
        </div>
      )}
    </DataCard>
  );
}

export const view: WidgetView<MusicSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Music section={section} />,
};
