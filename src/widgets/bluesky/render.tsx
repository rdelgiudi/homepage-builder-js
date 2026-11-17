import { DataCard, useWidgetData } from "../common";
import { PostList, type PostsData } from "../posts";
import type { WidgetView } from "../types";
import type { BlueskySection } from "./meta";

function Bluesky({ section }: { section: BlueskySection }) {
  const handle = section.handle.trim().replace(/^@/, "");
  const state = useWidgetData<PostsData>(handle ? `/api/widgets/bluesky?handle=${encodeURIComponent(handle)}` : null);
  return (
    <DataCard state={state} setup={!handle && "Set the handle in this widget's settings."} lines={5}>
      {(data) => <PostList data={data} limit={section.limit} />}
    </DataCard>
  );
}

export const view: WidgetView<BlueskySection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Bluesky section={section} />,
};
