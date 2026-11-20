import { redirect } from "next/navigation";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { HOME, pageView } from "@/lib/pages";
import { isAdminSession } from "@/lib/admin/auth";
import { getDraftConfig } from "@/lib/admin/publish";

/**
 * The site rendered from the unpublished draft, for the admin panel's preview iframe.
 * It lives under /admin so that a reverse proxy which sends only /admin and /api/admin
 * to the admin container still routes it there.
 */
export default async function PreviewPage() {
  if (!(await isAdminSession())) redirect("/admin/login");
  return <SitePage config={pageView(getDraftConfig() ?? getConfig(), HOME)} preview />;
}
