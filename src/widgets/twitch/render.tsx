import { compact, DataCard, timeAgo, useWidgetData } from "../common";
import { SectionTitle, WidgetFrame } from "../shared";
import type { WidgetRenderContext, WidgetView } from "../types";
import type { TwitchSection } from "./meta";

interface Channel {
  name: string;
  url: string;
  avatar: string | null;
  description: string;
  live: { title: string; game: string; viewers: number; startedAt: string; thumbnail: string | null } | null;
}

function Twitch({ section, ctx }: { section: TwitchSection; ctx: WidgetRenderContext }) {
  const user = section.username.trim();
  // The username is read from the config on the server (by section id); `u` only makes the URL change with it.
  // Re-checked every two minutes while the page is open, so "live" appears without a reload.
  const state = useWidgetData<Channel>(user ? `/api/widgets/twitch?id=${encodeURIComponent(section.id)}&u=${encodeURIComponent(user)}` : null, 2 * 60 * 1000);
  // Hidden while offline means no title and no frame either, so the title row and frame are drawn here.
  // Setup notices and errors still show, so the owner can see why nothing appears.
  if (section.hideOffline && state.data && !state.data.live) return null;
  return (
    <div>
      <SectionTitle icon={section.icon} text={section.text} align={section.align} invertDark={section.invertDark} type={section.type} />
      <WidgetFrame enabled={ctx.framed} colors={ctx.titleGradient} width={ctx.widgetFrameWidth}>
    <DataCard state={state} setup={!user && "Set your Twitch username in this widget's settings."} lines={2}>
      {(c) =>
        c.live ? (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="block text-left group">
            <span className="relative block overflow-hidden rounded-md aspect-video bg-gray-200 dark:bg-gray-700">
              {c.live.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN preview; not a next/image host
                <img src={c.live.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              )}
              <span className="absolute top-2 left-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">LIVE</span>
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{compact(c.live.viewers)} watching</span>
            </span>
            <span className="mt-2 block font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:underline">{c.live.title}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {c.name}
              {c.live.game && ` · ${c.live.game}`} · started {timeAgo(c.live.startedAt)}
            </span>
          </a>
        ) : (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-left group">
            {c.avatar && (
              // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar; not a next/image host
              <img src={c.avatar} alt="" width={48} height={48} className="w-12 h-12 rounded-full shrink-0 grayscale" />
            )}
            <span className="min-w-0">
              <span className="block font-medium text-gray-900 dark:text-white group-hover:underline">{c.name}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">Offline right now. Follow to know when I go live.</span>
            </span>
          </a>
        )
      }
    </DataCard>
      </WidgetFrame>
    </div>
  );
}

export const view: WidgetView<TwitchSection> = {
  titled: false,
  frame: "self",
  render: (section, ctx) => <Twitch section={section} ctx={ctx} />,
};
