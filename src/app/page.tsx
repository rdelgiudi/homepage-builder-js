import type { Metadata } from "next";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { requestLanguage } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/texts";
import { HOME, pageView } from "@/lib/pages";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The homepage's own name and tagline (homeSettings.header) when it has them; the root layout's otherwise. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const config = getConfig();
  const { name, tagline } = pageView(localize(config, (await requestLanguage(config, searchParams)).current), HOME);
  return { title: name, description: tagline };
}

export default async function Home({ searchParams }: Props) {
  const config = getConfig();
  const language = await requestLanguage(config, searchParams);
  // The homepage's own settings (homeSettings) apply over the site's.
  return <SitePage config={pageView(localize(config, language.current), HOME)} language={language} preview={false} />;
}
