"use client";

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "./api";

type Filter = "new" | "all";
type Status = "open" | "planned" | "playing" | "played" | "dismissed";

const STATUSES: [Status, string][] = [
  ["open", "Open"],
  ["planned", "Will play"],
  ["playing", "Playing"],
  ["played", "Played"],
  ["dismissed", "Dismissed (hidden)"],
];

interface Suggestion {
  id: number;
  name: string | null;
  note: string | null;
  created_at: number;
  read_at: number | null;
  author: string;
  blocked: boolean;
}

interface Game {
  appid: number;
  title: string;
  status: Status;
  unread: number;
  suggestions: Suggestion[];
}

interface ListResponse {
  games: Game[];
  counts: { unread: number; total: number };
}

const EMPTY: Record<Filter, string> = {
  new: "No new suggestions.",
  all: "No suggestions yet. Add a Game recommendations widget to a tab so visitors can suggest games.",
};

export default function SuggestionsScreen({ onCounts }: { onCounts: (unread: number) => void }) {
  const [filter, setFilter] = useState<Filter>("new");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (f: Filter = filter) => {
      try {
        const res = await api<ListResponse>(`suggestions?filter=${f}`);
        setData(res);
        onCounts(res.counts.unread);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [filter, onCounts]
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  /** Runs a change, then reloads so the list and counts are the server's truth. */
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const gameAction = (appid: number, action: "read" | "unread" | "delete" | "status", status?: Status) => act(() => api("suggestions", { method: "POST", body: { appids: [appid], action, status } }));
  const removeGame = (g: Game) =>
    window.confirm(`Delete all ${g.suggestions.length} suggestion${g.suggestions.length === 1 ? "" : "s"} for ${g.title}? This can't be undone.`) && gameAction(g.appid, "delete");
  const removeOne = (s: Suggestion) => window.confirm("Delete this suggestion? This can't be undone.") && act(() => api(`suggestions/${s.id}`, { method: "DELETE" }));
  const block = (s: Suggestion) => act(() => api(`suggestions/${s.id}`, { method: "PATCH", body: { blockAuthor: !s.blocked } }));

  if (!data) return <div className="adm-center adm-muted">{error ?? "Loading suggestions…"}</div>;
  const { games, counts } = data;

  return (
    <div className="adm-page">
      <h1>Game suggestions</h1>
      <p className="adm-hint">
        Games visitors suggested with the Game recommendations widget, most-suggested first. The status is shown next to the game in the widget&apos;s public list
        (when it is turned on); dismissed games are never shown there.
      </p>

      {error && <p className="adm-notice is-bad">{error}</p>}

      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={filter === "new"} onClick={() => setFilter("new")}>
          New <span className={`adm-count${counts.unread ? " is-draft" : ""}`}>{counts.unread}</span>
        </button>
        <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="adm-count">{counts.total}</span>
        </button>
      </div>

      <ul className="adm-comments">
        {games.map((g) => (
          <li key={g.appid} className={`adm-card adm-comment${g.unread ? " is-unread" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Steam store image */}
            <img src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`} alt="" width={138} height={64} style={{ borderRadius: 4, objectFit: "cover" }} />
            <div className="adm-comment-main">
              <div className="adm-comment-head">
                <strong>
                  <a className="adm-link" href={`https://store.steampowered.com/app/${g.appid}`} target="_blank" rel="noreferrer">
                    {g.title}
                  </a>
                </strong>
                <span className="adm-muted">
                  suggested by {g.suggestions.length} visitor{g.suggestions.length === 1 ? "" : "s"}
                </span>
                {g.unread > 0 && <span className="adm-tag is-draft">{g.unread} new</span>}
              </div>
              <ul className="adm-activity" style={{ marginTop: 8 }}>
                {g.suggestions.map((s) => (
                  <li key={s.id} style={{ alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="adm-comment-head">
                        <strong>{s.name ?? "Anonymous"}</strong>
                        <span className="adm-muted">{timeAgo(s.created_at)}</span>
                        {!s.read_at && <span className="adm-tag is-draft">new</span>}
                        <span className="adm-tag" title="Suggestions, messages and comments with the same tag come from the same browser">
                          visitor {s.author}
                        </span>
                        {s.blocked && <span className="adm-tag is-bad">blocked</span>}
                      </div>
                      {s.note && <p className="adm-comment-body" style={{ marginTop: 2 }}>{s.note}</p>}
                    </div>
                    <span className="adm-actions" style={{ flexShrink: 0, marginTop: 0 }}>
                      <button type="button" className="adm-btn is-small" onClick={() => block(s)} title="Blocks suggestions, messages and guestbook comments from this browser">
                        {s.blocked ? "Unblock" : "Block"}
                      </button>
                      <button type="button" className="adm-btn is-small is-danger" onClick={() => removeOne(s)}>
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="adm-actions">
                <select className="adm-input" style={{ width: "auto" }} aria-label={`Status of ${g.title}`} value={g.status} onChange={(e) => gameAction(g.appid, "status", e.target.value as Status)}>
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" className="adm-btn is-small" onClick={() => gameAction(g.appid, g.unread ? "read" : "unread")}>
                  {g.unread ? "Mark read" : "Mark unread"}
                </button>
                <button type="button" className="adm-btn is-small is-danger" onClick={() => removeGame(g)}>
                  Delete game
                </button>
              </div>
            </div>
          </li>
        ))}
        {!games.length && <li className="adm-empty">{EMPTY[filter]}</li>}
      </ul>
    </div>
  );
}
