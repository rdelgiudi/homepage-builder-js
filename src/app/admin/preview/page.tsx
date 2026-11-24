import { redirect } from "next/navigation";
import SitePage from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { previewLanguage } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/texts";
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
  const config = getDraftConfig() ?? getConfig();
  const language = await previewLanguage(config);
  return <SitePage config={pageView(localize(config, language.current), HOME)} language={language} preview />;
}
