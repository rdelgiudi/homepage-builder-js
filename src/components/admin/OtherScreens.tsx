"use client";

import { useEffect, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { api, timeAgo } from "./api";
import { useAdmin } from "./store";
import { WidgetIcon } from "@/widgets/BrandIcon";

interface Integrations {
  widgets: { type: string; label: string; icon: string; env: { name: string; set: boolean }[] }[];
  general: { name: string; set: boolean; note: string }[];
  storage: { label: string; path: string; writable: boolean }[];
  role: string;
}

const Status = ({ ok, yes, no }: { ok: boolean; yes: string; no: string }) => <span className={`adm-tag ${ok ? "is-live" : "is-bad"}`}>{ok ? yes : no}</span>;

export function IntegrationsScreen() {
  const [data, setData] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Integrations>("integrations")
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, []);
  if (!data) return <div className="adm-center adm-muted">{error ?? "Checking…"}</div>;

  return (
    <div className="adm-page">
      <h1>Integrations</h1>
      <p className="adm-lede">Keys and ids are set as environment variables on the server, never here. This page only shows whether each one is present.</p>

      <section className="adm-card">
        <h2>Widgets that need setup</h2>
        <table className="adm-table">
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
                  </td>
                  <td>
                    <Status ok={e.set} yes="Set" no="Not set" />
                  </td>
                </tr>
              ))
            )}
            {data.general.map((e) => (
              <tr key={e.name}>
                <td>General</td>
                <td>
                  <code>{e.name}</code>
                  {!e.set && <span className="adm-hint">{e.note}</span>}
                </td>
                <td>
                  <Status ok={e.set} yes="Set" no="Not set" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

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
