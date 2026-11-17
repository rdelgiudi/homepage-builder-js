import { useState } from "react";
import { DataCard, timeAgo, useWidgetData } from "../common";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { GameServerSection } from "./meta";

interface ServerStatus {
  online: boolean;
  players: number | null;
  maxPlayers: number | null;
  names: string[];
  name: string | null;
  map: string | null;
  version: string | null;
  game: string | null;
  icon: string | null;
  ms: number | null;
}

interface Checks {
  checkedAt: string;
  servers: ServerStatus[];
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {}
        );
      }}
      className="font-mono text-xs rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title="Copy the address"
    >
      {copied ? "Copied!" : address}
    </button>
  );
}

function GameServers({ section }: { section: GameServerSection }) {
  // Addresses are read on the server from this section's id; `u` only makes the URL change with them.
  const key = section.servers.map((s) => `${s.protocol}:${s.address}`).join(" ");
  const state = useWidgetData<Checks>(section.servers.length ? `/api/widgets/game-server?id=${encodeURIComponent(section.id)}&u=${encodeURIComponent(key)}` : null, 60 * 1000);
  return (
    <DataCard state={state} setup={!section.servers.length && "Add a server in this widget's settings."} lines={section.servers.length * 2}>
      {(checks) => (
        <div className="text-left">
          <ul className="space-y-3">
            {section.servers.slice(0, checks.servers.length).map((server, i) => {
              const s = checks.servers[i];
              const detail = [s.game && s.game !== server.label ? s.game : null, s.map, s.version].filter(Boolean).join(" · ");
              return (
                <li key={i} className="flex items-start gap-3">
                  {s.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the server's own icon, a data: URL
                    <img src={s.icon} alt="" className="w-10 h-10 shrink-0 rounded [image-rendering:pixelated]" />
                  ) : server.icon ? (
                    <span className="w-10 h-10 shrink-0 flex items-center justify-center text-2xl">
                      <Icon icon={server.icon} width={32} height={32} />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${s.online ? "bg-green-500" : "bg-red-500"}`} aria-hidden />
                      <span className="truncate font-medium text-gray-900 dark:text-white">{server.label}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-sm text-gray-600 dark:text-gray-300">
                        {s.online ? (s.players !== null ? `${s.players}${s.maxPlayers ? ` / ${s.maxPlayers}` : ""} online` : "Online") : "Offline"}
                      </span>
                    </div>
                    {s.online && s.name && <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line line-clamp-2">{s.name}</p>}
                    {s.online && detail && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
                    {section.showAddress && (
                      <div className="mt-1">
                        <CopyAddress address={server.address} />
                      </div>
                    )}
                    {section.showPlayers && s.online && s.names.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={s.names.join(", ")}>
                        {s.names.join(", ")}
                        {s.players !== null && s.players > s.names.length && ` and ${s.players - s.names.length} more`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Checked {timeAgo(checks.checkedAt)}</p>
        </div>
      )}
    </DataCard>
  );
}

export const view: WidgetView<GameServerSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <GameServers section={section} />,
};
