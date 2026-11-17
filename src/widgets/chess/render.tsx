import { compact, DataCard, Notice, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { ChessSection } from "./meta";

interface ChessData {
  name: string;
  url: string;
  ratings: { label: string; rating: number; games: number; provisional: boolean }[];
}

function Chess({ section }: { section: ChessSection }) {
  const user = section.username.trim();
  const state = useWidgetData<ChessData>(user ? `/api/widgets/chess?site=${section.site}&user=${encodeURIComponent(user)}` : null);
  return (
    <DataCard state={state} setup={!user && "Set a username in this widget's settings."} lines={3}>
      {(data) => (
        <div className="text-left">
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 dark:text-white hover:underline">
            {data.name}
          </a>
          <span className="text-xs text-gray-500 dark:text-gray-400"> on {section.site === "lichess" ? "Lichess" : "Chess.com"}</span>
          {data.ratings.length === 0 ? (
            <div className="mt-2"><Notice>No rated games yet.</Notice></div>
          ) : (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.ratings.map((r) => (
                <div key={r.label} className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{r.label}</p>
                  <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
                    {r.rating}
                    {r.provisional && <span title="Provisional rating">?</span>}
                  </p>
                  {r.games > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">{compact(r.games)} {r.label === "Puzzles" ? "solved" : "games"}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DataCard>
  );
}

export const view: WidgetView<ChessSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Chess section={section} />,
};
