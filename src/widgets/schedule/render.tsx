import { useEffect, useState } from "react";
import { linkHref, opens } from "@/lib/url";
import { Card, Notice } from "../common";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { ScheduleSection } from "./meta";
import { upcoming, WEEKDAYS, type Weekday } from "./occurrences";

const DAY_NAMES: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function visitorZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** "today" / "tomorrow" / the weekday, on the visitor's calendar. */
function dayLabel(ms: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(ms) - day(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return fmtDay.format(ms);
}

function inLabel(ms: number, now: number): string {
  const min = Math.round((ms - now) / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h} h`;
  return `in ${Math.round(h / 24)} d`;
}

function Schedule({ section }: { section: ScheduleSection }) {
  // Times depend on the visitor's clock and zone, so the converted list is drawn after mount;
  // the server renders the plain configured times.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const slots = section.items.filter((s) => s.label.trim() && s.days.length);
  if (!slots.length) return <Notice>Add a slot with at least one day in this widget&apos;s settings.</Notice>;

  if (now === null) {
    return (
      <Card className="text-left">
        <ul className="space-y-2">
          {slots.map((s, i) => (
            <li key={i} className="flex items-baseline gap-3 text-sm">
              <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{WEEKDAYS.filter((d) => s.days.includes(d)).map((d) => DAY_NAMES[d]).join(", ")}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">{s.time}</span>
              <span className="text-gray-900 dark:text-white">{s.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const list = upcoming(slots, section.timezone, now);
  const zone = visitorZone();
  const nextIndex = list.findIndex((o) => !o.live);
  return (
    <Card className="text-left">
      {list.length === 0 ? (
        <Notice>Nothing scheduled in the next seven days.</Notice>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {list.map((o, i) => {
            const slot = slots[o.slot];
            const url = linkHref(slot.url);
            const highlight = o.live || i === nextIndex;
            return (
              <li key={`${o.slot}-${o.start}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {/* Sized to its content: "08:00 PM–10:00 PM" must stay on one line. */}
                <div className="min-w-[6rem] shrink-0">
                  <p className={`text-sm font-semibold ${highlight ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}>{dayLabel(o.start, now)}</p>
                  <p className="whitespace-nowrap text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {fmtTime.format(o.start)}
                    {slot.duration > 0 && `–${fmtTime.format(o.end)}`}
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {slot.icon && <Icon icon={slot.icon} width={20} height={20} className="shrink-0" />}
                  {url ? (
                    <a href={url} {...opens(url)} className="truncate text-gray-900 dark:text-white hover:underline">
                      {slot.label}
                    </a>
                  ) : (
                    <span className="truncate text-gray-900 dark:text-white">{slot.label}</span>
                  )}
                </div>
                {o.live ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                    Live now
                  </span>
                ) : (
                  i === nextIndex && <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{inLabel(o.start, now)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
        {zone ? `Times in your time zone (${zone.replace(/_/g, " ")}).` : "Times in your time zone."}
        {section.note && ` ${section.note}`}
      </p>
    </Card>
  );
}

export const view: WidgetView<ScheduleSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Schedule section={section} />,
};
