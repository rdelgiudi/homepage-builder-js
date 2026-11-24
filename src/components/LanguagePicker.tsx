"use client";

import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE, PREVIEW_LANGUAGE_COOKIE, type SiteLanguage } from "@/lib/i18n/languages";

/** Message `{ type: PREVIEW_LANGUAGE, code }` the preview posts to the admin panel when its picker is used. */
export const PREVIEW_LANGUAGE = "homepage:preview-language";

const YEAR = 60 * 60 * 24 * 365;

export function rememberLanguage(code: string, preview: boolean) {
  document.cookie = preview ? `${PREVIEW_LANGUAGE_COOKIE}=${code}; path=/admin; samesite=lax` : `${LANGUAGE_COOKIE}=${code}; path=/; max-age=${YEAR}; samesite=lax`;
}

/**
 * Language picker: a small button with the open language's code over a native <select> (which
 * opens upward by itself at the bottom of the window and is a wheel on phones). Nothing with
 * fewer than two languages. The server renders the chosen language, so the page is refreshed.
 */
export default function LanguagePicker({ language, preview, look }: { language: SiteLanguage; preview: boolean; look: "banner" | "floating" | "footer" }) {
  const router = useRouter();
  const { current, choices } = language;
  if (choices.length < 2) return null;
  const open = choices.find((c) => c.code === current);

  const choose = (code: string) => {
    rememberLanguage(code, preview);
    if (preview && window.parent !== window) window.parent.postMessage({ type: PREVIEW_LANGUAGE, code }, window.location.origin);
    router.refresh();
  };

  const style = {
    banner: "h-9 w-14 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800",
    floating: "h-10 px-3.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:opacity-90 shadow-sm",
    footer: "h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800",
  }[look];
  return (
    <label
      className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${style}`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span aria-hidden>{look === "footer" ? (open?.name ?? current) : (open?.short ?? current.toUpperCase())}</span>
      <select aria-label="Language" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base" value={open ? current : ""} onChange={(e) => choose(e.target.value)}>
        {/* The preview can show a language visitors can't choose (yet). */}
        {!open && <option value="">{current}</option>}
        {choices.map((c) => (
          <option key={c.code} value={c.code} lang={c.code} className="text-gray-900 bg-white dark:text-white dark:bg-gray-800">
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
