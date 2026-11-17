import type { CSSProperties } from "react";
import { safeUrl } from "@/lib/background";
import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { ImageSection } from "./meta";

const SHAPE = { original: "h-auto", square: "aspect-square object-cover", wide: "aspect-video object-cover" };

export const view: WidgetView<ImageSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => {
    const images = section.images.flatMap((image) => {
      const src = safeUrl(image.src);
      return src ? [{ ...image, src }] : [];
    });
    if (!images.length) return <Notice>Add an image in this widget&apos;s settings.</Notice>;
    const columns = Math.min(section.columns, images.length);
    return (
      // At most two per row on phones; the chosen number from md up.
      <div className={`grid gap-3 ${columns > 1 ? "grid-cols-2" : "grid-cols-1"} md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]`} style={{ "--cols": columns } as CSSProperties}>
        {images.map((image, i) => (
          <figure key={i} className="min-w-0">
            <a href={safeUrl(image.link) ?? image.src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.alt ?? ""} loading="lazy" className={`w-full ${SHAPE[section.shape]} transition-transform duration-300 hover:scale-105`} />
            </a>
            {image.caption && <figcaption className="mt-1.5 text-sm text-center text-gray-500 dark:text-gray-400">{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  },
};
