import Link from "next/link";
import { SiteShell } from "@/components/SitePage";
import type { SiteLanguage } from "@/lib/i18n/languages";
import type { Post } from "@/lib/posts";
import { pagePath, sitePages } from "@/lib/pages";
import type { HomepageConfig } from "@/lib/schema/config";
import { tabSlug } from "@/lib/tab-slug";
import { postDateLabel } from "@/widgets/posts/date";

/**
 * One blog post inside the site's shell. Used by /posts/… (the published site) and
 * /admin/preview/posts/… (the draft, `preview`). `config` is already in `language`.
 */
export default function PostView({ post, config, language, preview }: { post: Post; config: HomepageConfig; language: SiteLanguage; preview: boolean }) {
  const author = post.author || config.postAuthor.trim();
  // "Back" returns to the page and tab that list the posts.
  const page = sitePages(config).find((p) => p.tabs.some((t) => t.sections.some((s) => s.type === "posts")));
  const tab = page?.tabs.find((t) => t.sections.some((s) => s.type === "posts"));
  const back = page && tab ? `${pagePath(page.slug)}${tab !== page.tabs[0] ? `?tab=${tabSlug(tab)}` : ""}` : "/";
  return (
    <SiteShell config={config} language={language} preview={preview} width="max-w-[870px]" homeHref="/">
      <Link href={back} className="mt-4 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
        ← Back
      </Link>
      <article className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2b2d31] p-6 md:p-10 text-left">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white break-words">{post.title}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {author && <>By {author} · </>}
            <time dateTime={post.date}>{postDateLabel(post.date)}</time> · {post.minutes} min read
          </p>
          {post.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded-md bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </header>
        {/* The owner's own markdown, rendered on the server (same as the markdown widget). */}
        <div className="prose prose-gray dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </SiteShell>
  );
}
