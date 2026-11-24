import Link from "next/link";
import { safeUrl } from "@/lib/background";
import type { BannerOptions } from "@/lib/schema/config";

interface SiteHeaderProps {
  name: string;
  tagline: string;
  titleGradient: string[];
  taglineGradient: string[];
  banner: BannerOptions;
  /**
   * `top` above the tabs · `bar` in one row with them (small) · `side` left-aligned, for the
   * sidebar layout's left column.
   */
  variant?: "top" | "bar" | "side";
  /** On pages other than the homepage (and blog posts) the name links back to it. */
  homeHref?: string;
}

const TEXT = { left: "text-left", center: "text-center", right: "text-right" };
const JUSTIFY = { left: "justify-start", center: "justify-center", right: "justify-end" };
/** A line only as wide as its text: a gradient over the full width would show one end of it. */
const FIT = { left: "w-fit max-w-full", center: "", right: "w-fit max-w-full ml-auto" };

/** Site name and/or logo + tagline. */
export default function SiteHeader({ name, tagline, titleGradient, taglineGradient, banner, variant = "top", homeHref }: SiteHeaderProps) {
  const side = variant === "side";
  const bar = variant === "bar";
  const position = side ? "left" : banner.titlePosition;
  const gradient = (colors: string[]) => (colors.length ? { backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})` } : undefined);

  const logo = banner.title === "name" ? null : safeUrl(banner.logo);
  const logoDark = logo && safeUrl(banner.logoDark);
  const showName = banner.title !== "logo" || !logo;

  const size = side ? "text-3xl" : bar ? "text-xl md:text-2xl" : "text-3xl md:text-5xl";
  const color = titleGradient.length ? "animate-gradient-text" : "text-gray-900 dark:text-white";
  const image = (src: string, mode: string) => (
    // An uploaded or external image of unknown size, sized by CSS. Beside the name it adds nothing to say.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={showName ? "" : name}
      className={`site-logo${bar ? " is-bar" : ""} ${mode}`}
      style={{ "--logo-h": `${banner.logoHeight}px`, objectPosition: position } as React.CSSProperties}
    />
  );
  const logos = logo && (
    <>
      {image(logo, logoDark ? "dark:hidden" : "")}
      {logoDark && image(logoDark, "hidden dark:block")}
    </>
  );

  // The heading's text carries the gradient itself when it is alone; beside a logo a span does.
  const link = (content: React.ReactNode, className = "") =>
    homeHref ? (
      <Link href={homeHref} className={`hover:opacity-80 transition-opacity ${className}`} title="Back to the homepage">
        {content}
      </Link>
    ) : className ? (
      <span className={className}>{content}</span>
    ) : (
      content
    );
  const fit = bar ? `w-fit max-w-full ${position === "center" ? "mx-auto" : position === "right" ? "ml-auto" : ""}` : side ? "" : FIT[position];
  const heading = logos ? (
    <h1 className={`font-bold ${size} flex ${bar ? fit : `${JUSTIFY[position]} ${side ? "break-words" : "pb-2"}`}`}>
      {link(
        <>
          {logos}
          {showName && (
            <span className={`${bar ? "truncate pb-1" : "min-w-0 pb-1 break-words"} ${color}`} style={gradient(titleGradient)}>
              {name}
            </span>
          )}
        </>,
        `flex min-w-0 max-w-full items-center ${bar ? "gap-2.5" : "flex-wrap gap-x-4 gap-y-2 " + JUSTIFY[position]}`
      )}
    </h1>
  ) : (
    <h1 className={`font-bold ${size} ${bar ? "truncate pb-1" : `pb-2${side ? " break-words" : ""}`} ${fit} ${color}`} style={gradient(titleGradient)}>
      {link(name)}
    </h1>
  );

  return (
    <div className={side ? "space-y-2" : bar ? "min-w-0" : `${TEXT[position]} space-y-3 md:space-y-4`}>
      {heading}
      {banner.showTagline && tagline && (
        <p
          className={`${bar ? `hidden md:block max-w-[15rem] text-xs truncate ${TEXT[position]} ${position === "center" ? "mx-auto" : position === "right" ? "ml-auto" : ""}` : side ? "text-base" : `text-base md:text-xl ${FIT[position]}`} ${
            taglineGradient.length ? "animate-gradient-text" : "text-gray-600 dark:text-gray-300"
          }`}
          style={gradient(taglineGradient)}
        >
          {tagline}
        </p>
      )}
    </div>
  );
}
