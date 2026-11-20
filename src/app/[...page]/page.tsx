import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { pageView } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** `/about` or `/about/colophon`: every level of the address. */
type Props = { params: Promise<{ page: string[] }> };

/** A page of the site other than the homepage (`config.pages`, see lib/pages.ts). */
const findPage = async (params: Props["params"]) => {
  // Addresses are lowercase-only, so /Page-2 finds /page-2 (the editor's site map counts it).
  const slug = (await params).page.join("/").toLowerCase();
  return getConfig().pages.find((p) => p.slug === slug);
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await findPage(params);
  if (!page) notFound();
  // The page's own name and tagline when it has them (settings.header), the site's otherwise.
  const { name, tagline } = pageView(getConfig(), page.id);
  return { title: `${page.title} · ${name}`, description: page.description || tagline };
}

export default async function ExtraPage({ params }: Props) {
  const page = await findPage(params);
  // Unknown addresses: a soft 404 (status 200 under the root loading boundary, like posts).
  if (!page) notFound();
  return <SitePage config={pageView(getConfig(), page.id)} preview={false} onPage />;
}
