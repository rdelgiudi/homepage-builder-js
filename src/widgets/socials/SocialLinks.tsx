import type { Align } from "../fields";
import { alignClass } from "../shared";
import { contrastOn, resolveSocials, type ResolvedSocial, type SocialPlatformKey } from "./platforms";

type Size = "sm" | "md" | "lg";

// Full class names so Tailwind generates them.
const ROUND: Record<Size, string> = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
const GLYPH: Record<Size, number> = { sm: 16, md: 20, lg: 24 };
const PILL: Record<Size, string> = { sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2 text-sm gap-2", lg: "px-5 py-3 text-base gap-2.5" };

function Glyph({ s, size }: { s: ResolvedSocial; size: number }) {
  if (s.platform.path) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden className="shrink-0">
        <path d={s.platform.path} />
      </svg>
    );
  }
  if (s.platform.glyph) {
    return (
      <span aria-hidden className="shrink-0 font-bold leading-none" style={{ fontSize: size * 0.8 }}>
        {s.platform.glyph}
      </span>
    );
  }
  // E-mail: envelope; anything else: globe.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {s.key === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      )}
    </svg>
  );
}

const MONO = "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700";

export interface SocialLinksProps {
  items: { url: string; platform?: SocialPlatformKey | "auto"; label?: string }[];
  style: "icons" | "buttons";
  colors: "brand" | "mono";
  size: Size;
  align?: Align;
  /** Replaces the alignment classes (e.g. responsive ones for the profile card). */
  justify?: string;
  gradientBorders?: boolean;
}

/** A row of social links; used by the `socials` widget and the profile card. Renders nothing without a valid link. */
export function SocialLinks({ items, style, colors, size, align, justify, gradientBorders }: SocialLinksProps) {
  const links = resolveSocials(items);
  if (!links.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${justify ?? alignClass(align)}`}>
      {links.map((s, i) => {
        const brandStyle = colors === "brand" ? { backgroundColor: `#${s.platform.hex}`, color: contrastOn(s.platform.hex) } : undefined;
        const external = !s.href.startsWith("mailto:");
        return (
          <li key={i}>
            <a
              href={s.href}
              {...(external ? { target: "_blank", rel: "me noopener noreferrer" } : null)}
              title={s.label}
              aria-label={style === "icons" ? s.label : undefined}
              style={brandStyle}
              // A thin ring keeps very dark brand colours (X, GitHub, Threads) visible on a dark page.
              className={`flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:scale-105 ring-1 ring-inset ring-black/5 dark:ring-white/15 ${
                style === "icons" ? `rounded-full ${ROUND[size]}` : `rounded-lg font-medium ${PILL[size]}`
              } ${colors === "brand" ? "hover:brightness-110" : MONO}${gradientBorders && style === "buttons" ? " gradient-border-card" : ""}`}
            >
              <Glyph s={s} size={GLYPH[size]} />
              {style === "buttons" && <span>{s.label}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
