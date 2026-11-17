import { useEffect, useState } from "react";
import { Card, Notice } from "../common";
import { zonedTimeToMs } from "../time";
import type { WidgetView } from "../types";
import type { CountdownSection } from "./meta";

function Countdown({ section }: { section: CountdownSection }) {
  const target = zonedTimeToMs(section.target, section.timezone);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (target === null) return <Card><Notice>Set the date and time in this widget&apos;s settings.</Notice></Card>;

  const left = now === null ? null : Math.max(0, Math.floor((target - now) / 1000));
  const units: [string, number | null][] = [
    ["days", left === null ? null : Math.floor(left / 86400)],
    ["hours", left === null ? null : Math.floor(left / 3600) % 24],
    ["minutes", left === null ? null : Math.floor(left / 60) % 60],
    ["seconds", left === null ? null : left % 60],
  ];

  return (
    <Card className="text-center">
      {section.label && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{section.label}</p>}
      {left === 0 ? (
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{section.doneText}</p>
      ) : (
        <div className="flex justify-center gap-2 sm:gap-4" role="timer">
          {units.map(([name, value]) => (
            <div key={name} className="min-w-[3.5rem] rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-2">
              <div className="text-2xl sm:text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{value === null ? "–" : String(value).padStart(2, "0")}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{name}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export const view: WidgetView<CountdownSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Countdown section={section} />,
};
