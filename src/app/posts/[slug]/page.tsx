import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SitePage";
import { getConfig } from "@/lib/config";
import { slugify } from "@/lib/schema/migrate";
import { getPost } from "@/lib/posts";
import { postDateLabel } from "@/widgets/posts/date";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) notFound();
  return { title: `${post.title} · ${getConfig().name}`, description: post.summary };
}

/** One blog post: a markdown file from src/content/ with a `date` in its front matter (see lib/posts.ts). */
export default async function PostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const config = getConfig();
  // "Back" returns to the tab that lists the posts.
  const tab = config.tabs.find((t) => t.sections.some((s) => s.type === "posts"));
  const back = tab && tab !== config.tabs[0] ? `/?tab=${slugify(tab.label)}` : "/";
  return (
    <SiteShell config={config} preview={false} width="max-w-[870px]">
      <Link href={back} className="mt-4 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
        ← Back
      </Link>
      <article className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2b2d31] p-6 md:p-10 text-left">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white break-words">{post.title}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
