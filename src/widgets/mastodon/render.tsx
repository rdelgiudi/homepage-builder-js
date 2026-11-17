import { DataCard, useWidgetData } from "../common";
import { PostList, type PostsData } from "../posts";
import type { WidgetView } from "../types";
import type { MastodonSection } from "./meta";

function Mastodon({ section }: { section: MastodonSection }) {
  const ready = !!section.instance.trim() && !!section.account.trim();
  // Server and account are looked up on the server from this section's id; `k` only makes the URL change when they do.
  const state = useWidgetData<PostsData>(ready ? `/api/widgets/mastodon?id=${encodeURIComponent(section.id)}&k=${encodeURIComponent(`${section.account}@${section.instance}`)}` : null);
  return (
    <DataCard state={state} setup={!ready && "Set the server and the account name in this widget's settings."} lines={5}>
      {(data) => <PostList data={data} limit={section.limit} />}
    </DataCard>
  );
}

export const view: WidgetView<MastodonSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Mastodon section={section} />,
};
