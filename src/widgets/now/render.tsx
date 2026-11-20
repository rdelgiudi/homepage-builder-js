import { Fragment, useEffect, useState } from "react";
import { linkHref, opens } from "@/lib/url";
import { Card, Notice } from "../common";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { NowSection } from "./meta";

/** "today", "yesterday", "3 days ago", "2 months ago" for a YYYY-MM-DD date (local calendar days). */
function sinceDate(date: string, now: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now);
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - then) / 86400000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function Now({ section }: { section: NowSection }) {
  // "x days ago" depends on the visitor's clock; render it after mount so server and client HTML agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const items = section.items.filter((item) => item.label.trim() || item.text.trim());
  if (!items.length) return <Notice>Add a line in this widget&apos;s settings.</Notice>;
  return (
    <Card className="text-left">
      {/* Label column = the longest label (all rows line up), capped at 60% so the text always keeps room; the text wraps. */}
      <dl className="grid grid-cols-[fit-content(60%)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5">
        {items.map((item, i) => {
          const url = linkHref(item.url);
          return (
            <Fragment key={i}>
              <dt className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {item.icon && <Icon icon={item.icon} width={18} height={18} className="shrink-0" />}
                <span className="min-w-0 break-words">{item.label}</span>
              </dt>
              <dd className="min-w-0 break-words text-gray-900 dark:text-white">
                {url ? (
                  <a href={url} {...opens(url)} className="hover:underline">
                    {item.text || url}
                  </a>
                ) : (
                  item.text || <span className="text-gray-400">—</span>
                )}
              </dd>
            </Fragment>
          );
        })}
      </dl>
      {section.updated && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400" title={section.updated}>
          Updated {now === null ? section.updated : sinceDate(section.updated, now)}
        </p>
      )}
    </Card>
  );
}

export const view: WidgetView<NowSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Now section={section} />,
};
