import { useEffect, useState } from "react";
import { httpUrl } from "@/lib/url";
import { zonedTimeToMs } from "../time";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { NoticeSection } from "./meta";

// Full class names so Tailwind generates them. Tinted, so they read on any background.
const TONES: Record<NoticeSection["tone"], { box: string; icon: string }> = {
  info: { box: "border-blue-500/40 bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100", icon: "ℹ️" },
  success: { box: "border-green-500/40 bg-green-50 text-green-900 dark:bg-green-500/15 dark:text-green-100", icon: "✅" },
  warning: { box: "border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100", icon: "⚠️" },
  danger: { box: "border-red-500/40 bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100", icon: "⛔" },
  neutral: { box: "border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100", icon: "📌" },
};

/** Short stable hash, so a dismissal is forgotten when the notice's text changes. */
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const storage = {
  get(key: string): boolean {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  },
  set(key: string) {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Private mode / blocked storage: closing still works for this visit.
    }
  },
};

function Notice({ section }: { section: NoticeSection }) {
  const until = section.until ? zonedTimeToMs(section.until, section.timezone) : null;
  const [expired, setExpired] = useState(() => until !== null && Date.now() >= until);
  const [dismissed, setDismissed] = useState(false);
  const key = `notice:${section.id}:${hash(`${section.title ?? ""}\n${section.message}`)}`;

  // Read after mount (server HTML has no localStorage).
  useEffect(() => {
    if (section.dismissible) setDismissed(storage.get(key));
  }, [key, section.dismissible]);

  // Hide it while the page is open if the time passes (only for the next day; longer timers are pointless).
  useEffect(() => {
    if (until === null) return setExpired(false);
    const left = until - Date.now();
    if (left <= 0) return setExpired(true);
    setExpired(false);
    if (left > 86400000) return;
    const timer = setTimeout(() => setExpired(true), left);
    return () => clearTimeout(timer);
  }, [until]);

  if (expired || dismissed || (!section.message.trim() && !section.title?.trim())) return null;

  const tone = TONES[section.tone];
  const link = httpUrl(section.linkUrl);
  return (
    <div role="status" className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left ${tone.box}`}>
      <Icon icon={section.icon || tone.icon} className="text-xl leading-6 shrink-0" width={22} height={22} />
      <div className="min-w-0 flex-1">
        {section.title && <p className="font-semibold">{section.title}</p>}
        {section.message && (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 opacity-90">
            {section.message}
            {link && (
              <>
                {" "}
                <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:opacity-80">
                  {section.linkText || "More"}
                </a>
              </>
            )}
          </p>
        )}
        {!section.message && link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-2 hover:opacity-80">
            {section.linkText || "More"}
          </a>
        )}
      </div>
      {section.dismissible && (
        <button
          type="button"
          onClick={() => {
            storage.set(key);
            setDismissed(true);
          }}
          className="-mr-1 shrink-0 rounded p-1 opacity-60 hover:opacity-100"
          aria-label="Close notice"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const view: WidgetView<NoticeSection> = {
  titled: false,
  frame: "none",
  render: (section) => <Notice section={section} />,
};
