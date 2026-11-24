import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostView from "@/components/PostView";
import { getConfig } from "@/lib/config";
import { requestLanguage } from "@/lib/i18n/server";
import { localize } from "@/lib/i18n/texts";
import { getPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

/** `/posts/blog/2026/hello` = src/content/blog/2026/hello.md (posts can live in folders). */
type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
/** The post in the visitor's language (its translated file, where there is one) and the site around it. */
const load = async ({ params, searchParams }: Props) => {
  const published = getConfig();
  const language = await requestLanguage(published, searchParams);
  return { post: getPost((await params).slug.join("/"), language.current), language, config: localize(published, language.current) };
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { post, config } = await load(props);
  if (!post) notFound();
  const author = post.author || config.postAuthor.trim();
  return { title: `${post.title} · ${config.name}`, description: post.summary, ...(author && { authors: [{ name: author }] }) };
}

/** One blog post: a markdown file from src/content/ with a `date` in its front matter (see lib/posts.ts). */
export default async function PostPage(props: Props) {
  const { post, config, language } = await load(props);
  if (!post) notFound();
  return <PostView post={post} config={config} language={language} preview={false} />;
}
