import { redirect } from "next/navigation";
import ConfigSync from "@/components/ConfigSync";
import PostView from "@/components/PostView";
import { getConfig } from "@/lib/config";
import { isAdminSession } from "@/lib/admin/auth";
import { getDraftConfig } from "@/lib/admin/publish";
import { contentLanguages } from "@/lib/i18n/languages";
import { previewLanguage } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/texts";
import { getPost } from "@/lib/posts";

/** A blog post in the admin preview: the draft's look and the preview's language (see ../../page.tsx). */
export default async function PreviewPostPage({ params }: { params: Promise<{ slug: string[] }> }) {
  if (!(await isAdminSession())) redirect("/admin/login");
  const config = getDraftConfig() ?? getConfig();
  const language = await previewLanguage(config);
  const slug = (await params).slug.join("/");
  const post = getPost(slug, language.current, contentLanguages(config.languages, getConfig().languages.original));
  if (!post) {
    // Not notFound(), like the other preview pages: a file saved meanwhile shows on the next refresh.
    return (
      <main className="min-h-screen grid place-items-center bg-gray-900 text-gray-400 text-sm">
        <p>There is no post at /posts/{slug}.</p>
        <ConfigSync preview />
      </main>
    );
  }
  return <PostView post={post} config={localize(config, language.current)} language={language} preview />;
}
