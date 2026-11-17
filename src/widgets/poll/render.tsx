import { useCallback, useEffect, useState } from "react";
import { Card, Notice, Skeleton } from "../common";
import type { WidgetView } from "../types";
import type { PollSection } from "./meta";

interface Results {
  counts: number[];
  total: number;
  voted: string | null;
}

function Poll({ section }: { section: PollSection }) {
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Refetch when the options change (the admin preview edits them live).
  const optionsKey = section.options.join("\u0000");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/poll?id=${encodeURIComponent(section.id)}`);
      const body = await res.json();
      if (res.ok) {
        setResults(body);
        setError(null);
      } else setError(body.error ?? "Could not load the poll.");
    } catch {
      setError("Could not load the poll.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, optionsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (option: string) => {
    if (busy || results?.voted === option) return;
    setBusy(true);
    try {
      const res = await fetch("/api/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: section.id, option }) });
      const body = await res.json();
      if (res.ok) {
        setResults(body);
        setError(null);
      } else if (res.status !== 429) setError(body.error ?? "Your vote could not be saved.");
    } catch {
      setError("Your vote could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  if (section.options.length < 2) return <Card><Notice>Add at least two options in this widget&apos;s settings.</Notice></Card>;
  if (!results && !error) return <Card><Skeleton lines={section.options.length} /></Card>;

  const showResults = !!results && (section.results === "always" || results.voted !== null);
  return (
    <Card className="text-left">
      {section.question && <p className="font-semibold text-gray-900 dark:text-white mb-3">{section.question}</p>}
      <div className="space-y-2">
        {section.options.map((option, i) => {
          const share = showResults && results!.total > 0 ? Math.round((results!.counts[i] / results!.total) * 100) : 0;
          const mine = results?.voted === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => vote(option)}
              disabled={busy || !results}
              aria-pressed={mine}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                mine ? "border-blue-500 text-gray-900 dark:text-white" : "border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              {showResults && <span className="absolute inset-y-0 left-0 bg-blue-500/20 transition-[width] duration-500" style={{ width: `${share}%` }} aria-hidden />}
              <span className="relative flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {option}
                  {mine && <span className="text-blue-600 dark:text-blue-400"> ✓</span>}
                </span>
                {showResults && <span className="tabular-nums text-gray-500 dark:text-gray-400">{share}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {error ?? (showResults ? `${results!.total} vote${results!.total === 1 ? "" : "s"}${results!.voted ? ". Pick another option to change yours." : ""}` : "Vote to see the results.")}
      </p>
    </Card>
  );
}

export const view: WidgetView<PollSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Poll section={section} />,
};
