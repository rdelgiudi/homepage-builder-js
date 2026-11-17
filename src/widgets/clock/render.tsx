import { useEffect, useState } from "react";
import { Card, Notice } from "../common";
import { zoneOffsetMinutes } from "../time";
import type { WidgetView } from "../types";
import type { ClockSection } from "./meta";

function difference(minutes: number): string {
  if (minutes === 0) return "Same time as you";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${[h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ")} ${minutes > 0 ? "ahead of" : "behind"} you`;
}

function Clock({ section }: { section: ClockSection }) {
  // The time is only known in the browser; render it after mount so server and client HTML agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  let time = "--:--";
  let date = "";
  let diff = "";
  if (now !== null) {
    try {
      const zone = section.timezone;
      time = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: section.hour12 }).format(now);
      date = new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: "long", day: "numeric", month: "long" }).format(now);
      diff = difference(zoneOffsetMinutes(now, zone) + new Date(now).getTimezoneOffset());
    } catch {
      return <Card><Notice>Choose a time zone in this widget&apos;s settings.</Notice></Card>;
    }
  }
  const place = section.place || section.timezone.split("/").pop()!.replace(/_/g, " ");

  return (
    <Card className="text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{place}</p>
      <p className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white my-1" suppressHydrationWarning>{time}</p>
      {section.showDate && <p className="text-sm text-gray-600 dark:text-gray-300">{date || " "}</p>}
      {section.showDifference && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{diff || " "}</p>}
    </Card>
  );
}

export const view: WidgetView<ClockSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Clock section={section} />,
};
