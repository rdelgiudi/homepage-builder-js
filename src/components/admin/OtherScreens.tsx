"use client";

import { useEffect, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, timeAgo } from "./api";
import { useAdmin } from "./store";
import { WidgetIcon } from "@/widgets/BrandIcon";

/** true / false = set or not; null = that container hasn't reported yet; "na" = not needed there. */
type Cell = boolean | null | "na";

interface EnvRow {
  name: string;
  cells: Cell[];
  optional?: boolean;
  note?: string;
  /** Set in both containers, to different values. */
  mismatch?: boolean;
}

interface Integrations {
  role: string;
  columns: string[];
  publicReportedAt: number | null;
  widgets: { type: string; label: string; icon: string; env: EnvRow[] }[];
  general: EnvRow[];
  notifications: {
    where: string;
    reported: boolean;
    valid: boolean;
    events: string[];
    vars: EnvRow[];
    lastSent: number | null;
    lastError: { at: number; text: string } | null;
  };
  storage: { label: string; path: string; writable: boolean }[];
}

const Status = ({ ok, yes, no }: { ok: boolean; yes: string; no: string }) => <span className={`adm-tag ${ok ? "is-live" : "is-bad"}`}>{ok ? yes : no}</span>;

/** Required: green / red. Optional: green / neutral, since leaving it out is fine. */
function EnvCell({ cell, optional }: { cell: Cell; optional?: boolean }) {
  if (cell === "na") return <span className="adm-muted">—</span>;
  if (cell === null) return <span className="adm-tag" title="This container hasn't reported its settings yet">Unknown</span>;
  if (optional && !cell) return <span className="adm-tag">Not set</span>;
  return <Status ok={cell} yes="Set" no="Not set" />;
}

const EVENT_LABELS: Record<string, string> = { message: "contact messages", comment: "comments", suggestion: "game suggestions" };

function ColumnHead({ columns, first }: { columns: string[]; first?: string }) {
  if (columns.length < 2) return null;
  return (
    <thead>
      <tr>
        <th>{first}</th>
        <th />
        {columns.map((c) => (
          <th key={c}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Two steps: a single-use ticket from the admin API, then the public route that sends it — that
 * request goes to the container with the NTFY_* variables (the public one, behind the proxy).
 */
async function sendTestNotification(): Promise<string | null> {
  const { ticket } = await api<{ ticket: string }>("notify-test", { method: "POST" });
  const res = await fetch("/api/notify-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }), cache: "no-store" });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
}

function TestButton({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; text?: string }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const error = await sendTestNotification();
      setState(error ? { busy: false, ok: false, text: error } : { busy: false, ok: true, text: "Sent. Check your phone." });
    } catch (err) {
      setState({ busy: false, ok: false, text: (err as Error).message });
    }
    onDone();
  };
  return (
    <div className="adm-test-row">
      <button type="button" className="adm-btn is-small" onClick={run} disabled={state.busy}>
        {state.busy ? "Sending…" : "Send test notification"}
      </button>
      {state.text && <span className={`adm-notice ${state.ok ? "" : "is-bad"}`}>{state.text}</span>}
    </div>
  );
}

function NotificationsCard({ n, onRefresh }: { n: Integrations["notifications"]; onRefresh: () => void }) {
  const topicSet = n.vars.some((v) => v.name === "NTFY_TOPIC" && v.cells[0] === true);
  return (
    <section className="adm-card">
      <h2>Notifications (ntfy)</h2>
      <p className="adm-hint">
        {!n.reported
          ? "The public container sends them, and it hasn't reported its settings yet. It does that when it starts: run the current build in both containers and restart the public one."
          : topicSet && n.valid
            ? `${n.where === "Public" ? "The public container sends" : "Sends"} a push for new ${n.events.map((e) => EVENT_LABELS[e] ?? e).join(", ") || "nothing (NTFY_EVENTS matches no event)"}.`
            : `Off${n.where === "Public" ? " in the public container, which is the one that sends them" : ""}.`}
      </p>
      {n.reported && (
        <table className="adm-table">
          <tbody>
            {n.vars.map((v) => (
              <tr key={v.name}>
                <td>
                  <code>{v.name}</code>
                  {v.note && <span className="adm-hint">{v.note}</span>}
                </td>
                <td className="adm-cell-status">
                  <EnvCell cell={v.cells[0]} optional={v.optional} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {topicSet && !n.valid && (
        <p className="adm-notice is-bad">NTFY_TOPIC or NTFY_URL is invalid, so nothing is sent. A topic may use letters, digits, - and _ (up to 64); the URL must start with http(s)://.</p>
      )}
      <TestButton onDone={onRefresh} />
      {(n.lastSent || n.lastError) && (
        <p className="adm-hint">
          {n.lastSent ? `Last notification sent ${timeAgo(n.lastSent)}.` : "No notification has been sent successfully yet."}
          {n.lastError && (!n.lastSent || n.lastError.at > n.lastSent) && (
            <span className="adm-notice is-bad">
              {" "}
              Last attempt failed {timeAgo(n.lastError.at)}: {n.lastError.text}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

export function IntegrationsScreen() {
  const [data, setData] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    api<Integrations>("integrations")
      .then(setData)
      .catch((err) => setError((err as Error).message));
  };
  useEffect(load, []);
  if (!data) return <div className="adm-center adm-muted">{error ?? "Checking…"}</div>;
  const split = data.columns.length > 1;

  return (
    <div className="adm-page">
      <h1>Integrations</h1>
      <p className="adm-lede">Keys and ids are set as environment variables on the server, never here. This page only shows whether each one is present.</p>
      {split && (
        <p className="adm-hint">
          {data.publicReportedAt
            ? `The public container's column is what it reported when it started, ${timeAgo(data.publicReportedAt)}. Restart it after changing its environment.`
            : "The public container hasn't reported its settings yet (it does when it starts). Run the current build in both containers and restart the public one."}{" "}
          The admin container needs the widget keys only for live data in the preview; values set in both are compared and must be the same.
        </p>
      )}

      <section className="adm-card">
        <h2>Widgets that need setup</h2>
        <table className="adm-table">
          <ColumnHead columns={data.columns} />
          <tbody>
            {data.widgets.flatMap((w) =>
              w.env.map((e, i) => (
                <tr key={`${w.type}-${e.name}`}>
                  <td>
                    {i === 0 && (
                      <>
                        <WidgetIcon type={w.type} fallback={w.icon} size={16} /> {w.label}
                      </>
                    )}
                  </td>
                  <td>
                    <code>{e.name}</code>
                    {e.note && <span className="adm-hint">{e.note}</span>}
                    {e.mismatch && <span className="adm-notice is-bad">Different in the two containers. Use the same value in both, so the preview shows what the site shows.</span>}
                  </td>
                  {e.cells.map((c, j) => (
                    <td key={j} className="adm-cell-status">
                      <EnvCell cell={c} optional={e.optional} />
                    </td>
                  ))}
                </tr>
              ))
            )}
            {data.general.map((e) => (
              <tr key={e.name}>
                <td>General</td>
                <td>
                  <code>{e.name}</code>
                  {e.cells.some((c) => c === false) && <span className="adm-hint">{e.note}</span>}
                  {e.mismatch && <span className="adm-notice is-bad">Different in the two containers: visitors get different ids in each, so blocks and own-comment checks don&apos;t line up.</span>}
                </td>
                {e.cells.map((c, j) => (
                  <td key={j} className="adm-cell-status">
                    <EnvCell cell={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <NotificationsCard n={data.notifications} onRefresh={load} />

      <section className="adm-card">
        <h2>Storage</h2>
        <table className="adm-table">
          <tbody>
            {data.storage.map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td>
                  <code>{s.path}</code>
                </td>
                <td>
                  <Status ok={s.writable} yes="Writable" no="Read-only" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="adm-hint">Publishing needs the site config to be writable; editing markdown needs the content folder to be writable.</p>
      </section>
    </div>
  );
}

interface Revision {
  id: number;
  createdAt: number;
  name: string;
  tabs: number;
  sections: number;
}

export function HistoryScreen({ onLoaded }: { onLoaded: () => void }) {
  const { replace, hasDraft } = useAdmin();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ revisions: Revision[] }>("revisions")
      .then((d) => setRevisions(d.revisions))
      .catch((err) => setError((err as Error).message));
  }, []);

  const load = async (r: Revision) => {
    if (hasDraft && !window.confirm("Replace your current draft with this version? You can undo it afterwards.")) return;
    try {
      const res = await api<{ draft: HomepageConfig }>("revisions", { method: "POST", body: { id: r.id } });
      replace(res.draft);
      onLoaded();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!revisions) return <div className="adm-center adm-muted">{error ?? "Loading history…"}</div>;

  return (
    <div className="adm-page">
      <h1>History</h1>
      <p className="adm-lede">Each time you publish, the version it replaced is kept here (the last 50). Loading one puts it in your draft — nothing changes on the live site until you publish.</p>
      {error && <p className="adm-notice is-bad">{error}</p>}
      <ul className="adm-comments">
        {revisions.map((r) => (
          <li key={r.id} className="adm-card adm-history">
            <div>
              <strong>{new Date(r.createdAt).toLocaleString()}</strong>
              <span className="adm-muted">
                {" "}
                replaced {timeAgo(r.createdAt)}
              </span>
              <div className="adm-muted">
                {r.name || "Unnamed site"}, {r.tabs} tab{r.tabs === 1 ? "" : "s"}, {r.sections} widget{r.sections === 1 ? "" : "s"}
              </div>
            </div>
            <button type="button" className="adm-btn" onClick={() => load(r)}>
              Load into draft
            </button>
          </li>
        ))}
        {!revisions.length && <li className="adm-empty">No earlier versions yet. The first one appears after you publish.</li>}
      </ul>
    </div>
  );
}
