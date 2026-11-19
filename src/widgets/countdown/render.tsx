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
  // [label, short label for narrow widgets, value]
  const units: [string, string, number | null][] = [
    ["days", "days", left === null ? null : Math.floor(left / 86400)],
    ["hours", "hrs", left === null ? null : Math.floor(left / 3600) % 24],
    ["minutes", "min", left === null ? null : Math.floor(left / 60) % 60],
    ["seconds", "sec", left === null ? null : left % 60],
  ];

  return (
    <Card className="text-center">
      {section.label && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{section.label}</p>}
      {left === 0 ? (
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{section.doneText}</p>
      ) : (
        // Sized by the widget's own width (container queries in globals.css), not the window's:
        // in a narrow grid column the tiles shrink and the labels shorten instead of overflowing.
        <div className="countdown">
          <div className="countdown-units" role="timer">
            {units.map(([name, short, value]) => (
              <div key={name} className="min-w-0 rounded-lg bg-gray-100 dark:bg-gray-800 px-1 py-2">
                <div className="countdown-value font-bold tabular-nums text-gray-900 dark:text-white">{value === null ? "–" : String(value).padStart(2, "0")}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  <span className="countdown-long">{name}</span>
                  <span className="countdown-short">{short}</span>
                </div>
              </div>
            ))}
          </div>
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
