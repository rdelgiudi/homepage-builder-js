import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card } from "../common";
import type { WidgetView } from "../types";
import type { GameSuggestSection } from "./meta";

// Keep in step with src/lib/game-suggestions.ts (re-checked on the server).
const NAME_MAX = 40;
const NOTE_MAX = 300;
const TERM_MIN = 2;
const DEBOUNCE_MS = 350;

const STEAM_ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
const capsule = (appid: number) => `${STEAM_ASSETS}/${appid}/header.jpg`;

interface Game {
  appid: number;
  title: string;
}

const STATUS_LABEL: Record<string, string> = { planned: "Will play", playing: "Playing", played: "Played" };

const input =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#1e1f22] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Capsule({ appid }: { appid: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="w-[92px] h-[43px] shrink-0 rounded bg-gray-200 dark:bg-gray-700" />;
  // eslint-disable-next-line @next/next/no-img-element -- Steam store images; host not in next.config
  return <img src={capsule(appid)} alt="" loading="lazy" onError={() => setFailed(true)} className="w-[92px] h-[43px] shrink-0 rounded object-cover bg-gray-200 dark:bg-gray-700" />;
}

/** Debounced Steam search; stale answers are aborted so results never arrive out of order. */
function useSteamSearch(sectionId: string, query: string) {
  const [results, setResults] = useState<Game[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const term = query.trim();
    if (term.length < TERM_MIN) {
      setResults([]);
      setState("idle");
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/game-suggestions/search?id=${encodeURIComponent(sectionId)}&q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setResults(body.results ?? []);
          setState("idle");
          setError(null);
        } else {
          setState("error");
          setError(body.error ?? "Search failed.");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState("error");
        setError("Search failed. Check your connection.");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sectionId, query]);
  return { results, state, error };
}

function TopList({ sectionId, refresh }: { sectionId: string; refresh: number }) {
  const [games, setGames] = useState<(Game & { status: string; count: number })[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game-suggestions?id=${encodeURIComponent(sectionId)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setGames(d.games ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sectionId, refresh]);
  if (!games?.length) return null;
  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Most suggested</p>
      <ol className="space-y-1.5">
        {games.map((g, i) => (
          <li key={g.appid} className="flex items-center gap-2 text-sm">
            <span className="w-5 shrink-0 text-right tabular-nums text-gray-400">{i + 1}.</span>
            <a href={`https://store.steampowered.com/app/${g.appid}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-gray-900 dark:text-white hover:underline">
              {g.title}
            </a>
            {STATUS_LABEL[g.status] && <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900 px-2 py-px text-[11px] text-green-800 dark:text-green-200">{STATUS_LABEL[g.status]}</span>}
            <span className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400" title={`Suggested by ${g.count}`}>
              ×{g.count}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GameSuggest({ section, gradientBorders }: { section: GameSuggestSection; gradientBorders: boolean }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState<Game | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [again, setAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const search = useSteamSearch(section.id, picked ? "" : query);
  const box = useRef<HTMLDivElement>(null);

  // Close the result list on a click elsewhere.
  useEffect(() => {
    const close = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const pick = (game: Game) => {
    setPicked(game);
    setOpen(false);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/game-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: section.id, appid: picked.appid, name, note, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAgain(!!data.again);
        setState("sent");
        setSentCount((n) => n + 1);
      } else {
        setError(data.error ?? "Your suggestion could not be sent.");
        setState("idle");
      }
    } catch {
      setError("Your suggestion could not be sent. Check your connection and try again.");
      setState("idle");
    }
  };

  const reset = () => {
    setPicked(null);
    setQuery("");
    setNote("");
    setState("idle");
  };

  const showList = open && !picked && query.trim().length >= TERM_MIN;

  return (
    <Card className="text-left">
      {state === "sent" && picked ? (
        <div className="text-center">
          <div className="flex justify-center">
            <Capsule appid={picked.appid} />
          </div>
          <p className="mt-2 text-gray-900 dark:text-white whitespace-pre-wrap">{again ? `You'd already suggested ${picked.title}; your note is updated.` : section.successText}</p>
          <button type="button" onClick={reset} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Suggest another game
          </button>
        </div>
      ) : (
        <>
          {section.intro && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{section.intro}</p>}
          <form onSubmit={submit} className="space-y-3">
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                <Capsule appid={picked.appid} />
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{picked.title}</span>
                <button type="button" onClick={() => setPicked(null)} className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <div ref={box}>
                {/* Results are in the flow, not a floating layer: a gradient frame isolates each widget, so a floating list would be painted under the next one. */}
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Game on Steam</span>
                  <input
                    className={input}
                    type="search"
                    value={query}
                    placeholder="Search for a game…"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls={`${section.id}-results`}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOpen(true);
                      setHighlight(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                      if (!showList || !search.results.length) return;
                      if (e.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, search.results.length - 1));
                      else if (e.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
                      else if (e.key === "Enter") pick(search.results[highlight]);
                      else if (e.key === "Escape") setOpen(false);
                      else return;
                      e.preventDefault();
                    }}
                  />
                </label>
                {showList && (
                  <ul
                    id={`${section.id}-results`}
                    role="listbox"
                    className="mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2b2d31]"
                  >
                    {search.state === "loading" && !search.results.length && <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</li>}
                    {search.state === "error" && <li className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{search.error}</li>}
                    {search.state === "idle" && !search.results.length && <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No games found.</li>}
                    {search.results.map((g, i) => (
                      <li
                        key={g.appid}
                        role="option"
                        aria-selected={i === highlight}
                        onPointerEnter={() => setHighlight(i)}
                        onClick={() => pick(g)}
                        className={`flex items-center gap-3 px-2 py-1.5 cursor-pointer ${i === highlight ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                      >
                        <Capsule appid={g.appid} />
                        <span className="min-w-0 truncate text-sm text-gray-900 dark:text-white">{g.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored by the server. */}
            <div aria-hidden className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none">
              <label>
                Website
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            {picked && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Why should I play it? (optional)</span>
                  <textarea className={`${input} resize-y`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} />
                </label>
                {section.askName && (
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Your name (optional)</span>
                    <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="nickname" />
                  </label>
                )}
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
              <button
                type="submit"
                disabled={!picked || state === "sending"}
                className={`shrink-0 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50${gradientBorders ? " gradient-border-card" : ""}`}
              >
                {state === "sending" ? "Sending…" : section.buttonText}
              </button>
            </div>
          </form>
        </>
      )}
      {section.showList && <TopList sectionId={section.id} refresh={sentCount} />}
    </Card>
  );
}

export const view: WidgetView<GameSuggestSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <GameSuggest section={section} gradientBorders={ctx.gradientBorders} />,
};
