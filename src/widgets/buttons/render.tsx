import { safeUrl } from "@/lib/background";
import { httpUrl, linkHref, opens } from "@/lib/url";
import { Notice } from "../common";
import { alignClass } from "../shared";
import type { WidgetView } from "../types";
import type { ButtonsSection } from "./meta";

function RingLink({ href, children, label }: { href: string | null; children: string; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 hover:underline">
      {children}
    </a>
  );
}

export const view: WidgetView<ButtonsSection> = {
  titled: true,
  frame: "none",
  render: (section) => {
    const buttons = section.items.flatMap((item) => {
      const src = safeUrl(item.image);
      return src ? [{ ...item, src, href: linkHref(item.url) }] : [];
    });
    const ring = { home: httpUrl(section.ringHome), prev: httpUrl(section.ringPrev), next: httpUrl(section.ringNext), random: httpUrl(section.ringRandom) };
    const hasRing = !!(section.ringName || ring.home || ring.prev || ring.next || ring.random);
    if (!buttons.length && !hasRing) return <Notice>Add a button or a webring in this widget&apos;s settings.</Notice>;

    const align = alignClass(section.align);
    return (
      <div className="space-y-3">
        {buttons.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${align}`}>
            {buttons.map((b, i) => {
              const img = (
                // eslint-disable-next-line @next/next/no-img-element -- fixed 88×31 pixel art from any host; next/image would resample it
                <img
                  src={b.src}
                  alt={b.label}
                  title={b.label || undefined}
                  width={88}
                  height={31}
                  loading="lazy"
                  className={`block w-[88px] h-[31px]${section.pixelated ? " [image-rendering:pixelated]" : ""}`}
                />
              );
              return b.href ? (
                <a key={i} href={b.href} {...opens(b.href)} className="block transition-transform duration-150 hover:-translate-y-0.5">
                  {img}
                </a>
              ) : (
                <span key={i}>{img}</span>
              );
            })}
          </div>
        )}
        {hasRing && (
          <nav aria-label={section.ringName ? `${section.ringName} webring` : "Webring"} className={`flex flex-wrap items-center gap-1 text-sm text-gray-700 dark:text-gray-300 ${align}`}>
            <RingLink href={ring.prev} label="Previous site in the webring">← prev</RingLink>
            {ring.home ? (
              <RingLink href={ring.home} label="Webring home page">{section.ringName || "webring"}</RingLink>
            ) : (
              section.ringName && <span className="px-2 py-1">{section.ringName}</span>
            )}
            <RingLink href={ring.random} label="Random site in the webring">random</RingLink>
            <RingLink href={ring.next} label="Next site in the webring">next →</RingLink>
          </nav>
        )}
      </div>
    );
  },
};
