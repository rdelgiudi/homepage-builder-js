import { compact, timeAgo } from "./common";

export interface PostsData {
  author: { name: string; handle: string; avatar: string | null; url: string | null };
  posts: { text: string; url: string | null; date: string | null; likes: number; reposts: number; replies: number }[];
}

/** Author line + a few posts. Shared by the Mastodon and Bluesky widgets. */
export function PostList({ data, limit }: { data: PostsData; limit: number }) {
  const posts = data.posts.slice(0, limit);
  return (
    <div className="space-y-3 text-left">
      <a href={data.author.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 group">
        {data.author.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.author.avatar} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full flex-shrink-0" />
        )}
        <span className="min-w-0">
          <span className="block font-semibold text-gray-900 dark:text-white truncate group-hover:underline">{data.author.name}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{data.author.handle}</span>
        </span>
      </a>
      {posts.length === 0 && <p className="italic text-sm text-gray-500 dark:text-gray-400">No public posts yet.</p>}
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {posts.map((post, i) => (
          <li key={post.url ?? i} className="py-3 first:pt-0 last:pb-0">
            <a href={post.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block group">
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-6">{post.text || "(no text)"}</p>
              <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="group-hover:underline">{timeAgo(post.date)}</span>
                <span title="Likes">♥ {compact(post.likes)}</span>
                <span title="Reposts">↻ {compact(post.reposts)}</span>
                <span title="Replies">💬 {compact(post.replies)}</span>
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
