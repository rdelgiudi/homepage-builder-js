import { httpUrl } from "@/lib/url";
import { DataCard, timeAgo, useWidgetData } from "../common";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { StatusSection } from "./meta";

type State = "up" | "degraded" | "down";

interface Checks {
  checkedAt: string;
  services: { state: State; code: number | null; ms: number | null }[];
}

const DOT: Record<State, string> = { up: "bg-green-500", degraded: "bg-yellow-500", down: "bg-red-500" };
const WORD: Record<State, string> = { up: "Up", degraded: "Problem", down: "Down" };

function Status({ section }: { section: StatusSection }) {
  // The addresses are looked up on the server from this section's id; `u` only makes the URL change with them.
  const key = section.services.map((s) => s.url).join(" ");
  const state = useWidgetData<Checks>(section.services.length ? `/api/widgets/status?id=${encodeURIComponent(section.id)}&u=${encodeURIComponent(key)}` : null, 60 * 1000);
  return (
    <DataCard state={state} setup={!section.services.length && "Add a service in this widget's settings."} lines={section.services.length}>
      {(checks) => {
        const down = checks.services.filter((c) => c.state !== "up").length;
        return (
          <div className="text-left">
            <p className={`mb-3 text-sm font-medium ${down ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {down ? `${down} of ${checks.services.length} with problems` : "All systems running"}
            </p>
            <ul className="space-y-2">
              {section.services.slice(0, checks.services.length).map((service, i) => {
                const c = checks.services[i];
                const url = section.linked ? httpUrl(service.url) : null;
                return (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={`relative w-2.5 h-2.5 shrink-0 rounded-full ${DOT[c.state]}`} aria-hidden>
                      {c.state === "up" && <span className={`absolute inset-0 rounded-full ${DOT.up} animate-ping opacity-40`} />}
                    </span>
                    {service.icon && <Icon icon={service.icon} width={18} height={18} />}
                    <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-white">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {service.label}
                        </a>
                      ) : (
                        service.label
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400" title={c.code ? `HTTP ${c.code}` : "No answer"}>
                      {c.state === "up" && section.showLatency && c.ms !== null ? `${c.ms} ms` : WORD[c.state]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Checked {timeAgo(checks.checkedAt)}</p>
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<StatusSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Status section={section} />,
};
