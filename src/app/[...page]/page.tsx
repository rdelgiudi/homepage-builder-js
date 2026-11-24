import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { requestLanguage } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/texts";
import { pageView } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** `/about` or `/about/colophon`: every level of the address. */
type Props = { params: Promise<{ page: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** A page of the site other than the homepage (`config.pages`, see lib/pages.ts). */
const findPage = async ({ params, searchParams }: Props) => {
  // Addresses are lowercase-only, so /Page-2 finds /page-2 (the editor's site map counts it).
  const slug = (await params).page.join("/").toLowerCase();
  const published = getConfig();
  const language = await requestLanguage(published, searchParams);
  const config = localize(published, language.current);
  return { page: config.pages.find((p) => p.slug === slug), config, language };
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { page, config } = await findPage(props);
  if (!page) notFound();
  // The page's own name and tagline when it has them (settings.header), the site's otherwise.
  const { name, tagline } = pageView(config, page.id);
  return { title: `${page.title} · ${name}`, description: page.description || tagline };
}

export default async function ExtraPage(props: Props) {
  const { page, config, language } = await findPage(props);
  // Unknown addresses: a soft 404 (status 200 under the root loading boundary, like posts).
  if (!page) notFound();
  return <SitePage config={pageView(config, page.id)} language={language} preview={false} onPage />;
}
