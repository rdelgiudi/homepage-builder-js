import { safeUrl } from "@/lib/background";
import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { ProfileSection } from "./meta";
import { SocialLinks } from "../socials/SocialLinks";

const SHAPE = { circle: "rounded-full", rounded: "rounded-2xl", square: "rounded-none" };

function Profile({ section, gradientBorders }: { section: ProfileSection; gradientBorders: boolean }) {
  const avatar = safeUrl(section.avatar);
  const name = section.name.trim();
  if (!avatar && !name && !section.bio?.trim()) return <Notice>Add your name, a picture or a bio in this widget&apos;s settings.</Notice>;

  const side = section.layout === "side";
  const surface = section.card ? "bg-white dark:bg-[#2b2d31] rounded-xl border border-gray-200 dark:border-gray-700 p-6" : "py-2";

  return (
    <div className={`${surface} flex flex-col items-center gap-5 text-center ${side ? "sm:flex-row sm:items-start sm:text-left" : ""}`}>
      {avatar && (
        // eslint-disable-next-line @next/next/no-img-element -- uploads or any http(s) host
        <img
          src={avatar}
          alt={name}
          className={`${side ? "w-28 h-28" : "w-32 h-32"} shrink-0 object-cover ${SHAPE[section.avatarShape]} ring-4 ring-white/70 dark:ring-white/10 shadow-md`}
        />
      )}
      <div className={`min-w-0 flex-1 flex flex-col items-center gap-2${side ? " sm:items-start" : ""}`}>
        {(name || section.pronouns) && (
          <p className={`flex flex-wrap items-baseline justify-center gap-x-2${side ? " sm:justify-start" : ""}`}>
            {name && <span className="text-2xl font-bold text-gray-900 dark:text-white">{name}</span>}
            {section.pronouns && <span className="text-sm text-gray-500 dark:text-gray-400">{section.pronouns}</span>}
          </p>
        )}
        {section.location && (
          <p className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span>{section.location}</span>
          </p>
        )}
        {section.bio && <p className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{section.bio}</p>}
        {section.socials.length > 0 && (
          <div className="mt-2">
            <SocialLinks items={section.socials} style={section.style} colors={section.colors} size={section.size} justify={side ? "justify-center sm:justify-start" : "justify-center"} gradientBorders={gradientBorders} />
          </div>
        )}
      </div>
    </div>
  );
}

export const view: WidgetView<ProfileSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <Profile section={section} gradientBorders={ctx.gradientBorders} />,
};
