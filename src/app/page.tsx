import type { Metadata } from "next";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { HOME, pageView } from "@/lib/pages";

export const dynamic = "force-dynamic";

/** The homepage's own name and tagline (homeSettings.header) when it has them; the root layout's otherwise. */
export function generateMetadata(): Metadata {
  const { name, tagline } = pageView(getConfig(), HOME);
  return { title: name, description: tagline };
}

export default function Home() {
  // The homepage's own settings (homeSettings) apply over the site's.
  return <SitePage config={pageView(getConfig(), HOME)} preview={false} />;
}
