import Link from "next/link";
import { DataCard, useWidgetData } from "../common";
import { postDateLabel } from "./date";
import type { WidgetView } from "../types";
import type { PostsSection } from "./meta";

interface PostSummary {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  minutes: number;
  author?: string;
}

function Info({ post, section, defaultAuthor }: { post: PostSummary; section: PostsSection; defaultAuthor: string }) {
  const author = section.showAuthor ? post.author || defaultAuthor.trim() : "";
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {author && `By ${author} · `}
      <time dateTime={post.date}>{postDateLabel(post.date)}</time>
      {section.showReadingTime && ` · ${post.minutes} min read`}
    </p>
  );
}

function Posts({ section, gradientBorders, defaultAuthor }: { section: PostsSection; gradientBorders: boolean; defaultAuthor: string }) {
  const tag = section.tag?.trim();
  const state = useWidgetData<{ posts: PostSummary[] }>(`/api/widgets/posts${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`);
  return (
    <DataCard state={state} lines={4}>
      {({ posts: all }) => {
        const posts = all.slice(0, section.limit);
        if (!posts.length) return <p className="italic text-sm text-gray-500 dark:text-gray-400">No posts yet.</p>;
        if (section.layout === "cards") {
          return (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 text-left">
              {posts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/posts/${post.slug}`}
                    className={`flex h-full flex-col gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md${gradientBorders ? " gradient-border-card" : ""}`}
                  >
                    <Info post={post} section={section} defaultAuthor={defaultAuthor} />
                    <p className="font-semibold text-gray-900 dark:text-white">{post.title}</p>
                    {section.showSummary && post.summary && <p className="line-clamp-3 text-sm text-gray-600 dark:text-gray-300">{post.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-left">
            {posts.map((post) => (
              <li key={post.slug} className="py-3 first:pt-0 last:pb-0">
                <Link href={`/posts/${post.slug}`} className="group block">
                  <p className="font-semibold text-gray-900 dark:text-white group-hover:underline">{post.title}</p>
                  <Info post={post} section={section} defaultAuthor={defaultAuthor} />
                  {section.showSummary && post.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{post.summary}</p>}
                </Link>
              </li>
            ))}
          </ul>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<PostsSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <Posts section={section} gradientBorders={ctx.gradientBorders} defaultAuthor={ctx.postAuthor} />,
};
