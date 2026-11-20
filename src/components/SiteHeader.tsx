import Link from "next/link";

interface SiteHeaderProps {
  name: string;
  tagline: string;
  titleGradient: string[];
  taglineGradient: string[];
  /** `side` — left-aligned and smaller, for the sidebar layout's left column. */
  variant?: "top" | "side";
  /** On pages other than the homepage (and blog posts) the name links back to it. */
  homeHref?: string;
}

/** Site name + tagline. */
export default function SiteHeader({ name, tagline, titleGradient, taglineGradient, variant = "top", homeHref }: SiteHeaderProps) {
  const side = variant === "side";
  const gradient = (colors: string[]) => (colors.length ? { backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})` } : undefined);
  return (
    <div className={side ? "space-y-2" : "text-center space-y-3 md:space-y-4"}>
      <h1
        className={`font-bold pb-2 ${side ? "text-3xl break-words" : "text-3xl md:text-5xl"}${titleGradient.length ? " animate-gradient-text" : " text-gray-900 dark:text-white"}`}
        style={gradient(titleGradient)}
      >
        {homeHref ? (
          <Link href={homeHref} className="hover:opacity-80 transition-opacity" title="Back to the homepage">
            {name}
          </Link>
        ) : (
          name
        )}
      </h1>
      <p className={`${side ? "text-base" : "text-base md:text-xl"} ${taglineGradient.length ? "animate-gradient-text" : "text-gray-600 dark:text-gray-300"}`} style={gradient(taglineGradient)}>
        {tagline}
      </p>
    </div>
  );
}
