import { redirect } from "next/navigation";
import SitePage from "@/components/SitePage";
import ConfigSync from "@/components/ConfigSync";
import { getConfig } from "@/lib/config";
import { isAdminSession } from "@/lib/admin/auth";
import { getDraftConfig } from "@/lib/admin/publish";
import { pageView } from "@/lib/pages";

/** A page other than the homepage, rendered from the draft for the admin preview (see ../page.tsx). */
export default async function PreviewExtraPage({ params }: { params: Promise<{ page: string }> }) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const config = getDraftConfig() ?? getConfig();
  const slug = (await params).page.toLowerCase();
  const page = config.pages.find((p) => p.slug === slug);
  if (!page) {
    // Not notFound(): the panel opens a new page in the preview before its draft is saved (500 ms
    // autosave), and Next keeps showing a not-found boundary until the address changes, so the
    // refresh after the save couldn't replace it. A plain placeholder is replaced by that refresh.
    return (
      <main className="min-h-screen grid place-items-center bg-gray-900 text-gray-400 text-sm">
        <p>There is no page at /{slug} in the draft{" "}(yet).</p>
        <ConfigSync preview />
      </main>
    );
  }
  return <SitePage config={pageView(config, page.id)} preview onPage />;
}
