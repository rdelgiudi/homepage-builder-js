interface SiteHeaderProps {
  name: string;
  tagline: string;
  titleGradient: string[];
  taglineGradient: string[];
  /** `side` — left-aligned and smaller, for the sidebar layout's left column. */
  variant?: "top" | "side";
}

/** Site name + tagline. */
export default function SiteHeader({ name, tagline, titleGradient, taglineGradient, variant = "top" }: SiteHeaderProps) {
  const side = variant === "side";
  const gradient = (colors: string[]) => (colors.length ? { backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})` } : undefined);
  return (
    <div className={side ? "space-y-2" : "text-center space-y-3 md:space-y-4"}>
      <h1
        className={`font-bold pb-2 ${side ? "text-3xl break-words" : "text-3xl md:text-5xl"}${titleGradient.length ? " animate-gradient-text" : " text-gray-900 dark:text-white"}`}
        style={gradient(titleGradient)}
      >
        {name}
      </h1>
      <p className={`${side ? "text-base" : "text-base md:text-xl"} ${taglineGradient.length ? "animate-gradient-text" : "text-gray-600 dark:text-gray-300"}`} style={gradient(taglineGradient)}>
        {tagline}
      </p>
    </div>
  );
}
