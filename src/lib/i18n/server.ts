/** Which language a request gets (server only: reads the request's cookies and headers). */
import { cookies, headers } from "next/headers";
import type { HomepageConfig } from "@/lib/schema/config";
import { LANGUAGE_COOKIE, PREVIEW_LANGUAGE_COOKIE, languageChoices, pickLanguage, type SiteLanguage } from "./languages";

type Query = Promise<Record<string, string | string[] | undefined>> | undefined;

/** The languages offered to visitors: the original and every translation that is switched on, whatever is translated so far. */
export const presentLanguages = (config: HomepageConfig): string[] => [config.languages.original, ...config.languages.translations.filter((t) => t.enabled).map((t) => t.code)];

/** The public site: `?lang=`, then the visitor's earlier choice, then (if `detect`) their browser. */
export async function requestLanguage(config: HomepageConfig, query?: Query): Promise<SiteLanguage> {
  const { original, detect, translations } = config.languages;
  if (!translations.length) return { current: original, original, choices: [] };
  const available = presentLanguages(config);
  const asked = (await query)?.lang;
  const current = pickLanguage(available, original, {
    query: typeof asked === "string" ? asked : null,
    cookie: (await cookies()).get(LANGUAGE_COOKIE)?.value,
    accept: detect ? (await headers()).get("accept-language") : null,
  });
  return { current, original, choices: languageChoices(available) };
}

/** The admin preview: the language the panel is showing, also one that isn't shown to visitors (yet). */
export async function previewLanguage(config: HomepageConfig): Promise<SiteLanguage> {
  const { original, translations } = config.languages;
  if (!translations.length) return { current: original, original, choices: [] };
  const cookie = (await cookies()).get(PREVIEW_LANGUAGE_COOKIE)?.value;
  const current = pickLanguage([original, ...translations.map((t) => t.code)], original, { cookie });
  return { current, original, choices: languageChoices(presentLanguages(config)) };
}
