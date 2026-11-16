"use client";

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "./api";

type Status = "pending" | "approved" | "rejected";

interface Comment {
  id: number;
  name: string;
  body: string;
  created_at: string;
  status: Status;
  author: string | null;
  blocked: boolean;
  edited_at: number | null;
}

interface Settings {
  mode: "off" | "pre";
  holdWords: string[];
}

interface Activity {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: number;
}

interface ListResponse {
  comments: Comment[];
  hasMore: boolean;
  counts: Record<Status, number>;
  settings: Settings;
  activity: Activity[];
}

const STATUS_LABEL: Record<Status, string> = { pending: "Waiting", approved: "Published", rejected: "Rejected" };
const EMPTY: Record<Status, string> = {
  pending: "Nothing is waiting for approval.",
  approved: "No published comments yet.",
  rejected: "No rejected comments.",
};
const ACTIVITY_LABEL: Record<string, string> = {
  "comment.approve": "Approved",
  "comment.reject": "Rejected",
  "comment.hold": "Moved back to waiting",
  "comment.delete": "Deleted",
  "comment.edit": "Edited",
  "comment.block": "Blocked the author of",
  "comment.unblock": "Unblocked the author of",
  "comment.settings": "Changed moderation settings",
};

// SQLite stores created_at as UTC without a zone marker.
const parseCreated = (s: string) => new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`).getTime();

export default function CommentsScreen({ onCounts }: { onCounts: (pending: number) => void }) {
  const [status, setStatus] = useState<Status>("pending");
  const [data, setData] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ id: number; name: string; body: string } | null>(null);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (s: Status = status) => {
      try {
        const res = await api<ListResponse>(`comments?status=${s}`);
        setData(res);
        onCounts(res.counts.pending);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [status, onCounts]
  );

  useEffect(() => {
    setSelected(new Set());
    load(status);
  }, [status, load]);

  /** Runs a change, then reloads the list so counts and rows are always the server's truth. */
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setSelected(new Set());
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const patch = (id: number, body: Record<string, unknown>) => act(() => api(`comments/${id}`, { method: "PATCH", body }));
  const remove = (c: Comment) => window.confirm(`Delete the comment by ${c.name}? This can't be undone.`) && act(() => api(`comments/${c.id}`, { method: "DELETE" }));
  const bulk = (action: "approve" | "reject" | "delete") => {
    const ids = [...selected];
    if (action === "delete" && !window.confirm(`Delete ${ids.length} comment${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    act(() => api("comments", { method: "POST", body: { ids, action } }));
  };
  const saveSettings = (settings: Settings) => act(() => api("comments/settings", { method: "PUT", body: settings }));

  if (!data) return <div className="adm-center adm-muted">{error ?? "Loading comments…"}</div>;
  const { comments, counts, settings } = data;
  const allSelected = comments.length > 0 && comments.every((c) => selected.has(c.id));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="adm-page">
      <h1>Comments</h1>

      <section className="adm-card">
        <div className="adm-field">
          <span className="adm-label">New comments</span>
          <div className="adm-seg" role="group" aria-label="New comments">
            <button type="button" aria-pressed={settings.mode === "off"} onClick={() => saveSettings({ ...settings, mode: "off" })}>
              Publish right away
            </button>
            <button type="button" aria-pressed={settings.mode === "pre"} onClick={() => saveSettings({ ...settings, mode: "pre" })}>
              Wait for my approval
            </button>
          </div>
          <span className="adm-hint">
            {settings.mode === "pre"
              ? "Every new comment waits here until you approve it. Its author sees it marked as awaiting approval; nobody else does."
              : "Comments appear on the site immediately. You can still reject or delete them afterwards."}
          </span>
        </div>
        <div className="adm-field">
          <span className="adm-label">Always hold comments containing</span>
          <div className="adm-chips">
            {settings.holdWords.map((w) => (
              <span key={w} className="adm-chip">
                {w}
                <button type="button" aria-label={`Remove ${w}`} onClick={() => saveSettings({ ...settings, holdWords: settings.holdWords.filter((x) => x !== w) })}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <form
            className="adm-inline"
            onSubmit={(e) => {
              e.preventDefault();
              if (!word.trim()) return;
              saveSettings({ ...settings, holdWords: [...settings.holdWords, word] });
              setWord("");
            }}
          >
            <input className="adm-input" aria-label="Word or phrase to hold" placeholder="Word or phrase" value={word} onChange={(e) => setWord(e.target.value)} />
            <button type="submit" className="adm-btn is-small">
              Add
            </button>
          </form>
          <span className="adm-hint">Matching comments wait for approval even when comments publish right away. Not case-sensitive.</span>
        </div>
      </section>

      {error && <p className="adm-notice is-bad">{error}</p>}

      <div className="adm-tabs" role="tablist">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={s === status} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]} <span className={`adm-count${s === "pending" && counts[s] ? " is-draft" : ""}`}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {comments.length > 0 && (
        <div className="adm-bulk">
          <label className="adm-check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(comments.map((c) => c.id)))} />
            {selected.size ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              {status !== "approved" && (
                <button type="button" className="adm-btn is-small" onClick={() => bulk("approve")}>
                  Approve
                </button>
              )}
              {status !== "rejected" && (
                <button type="button" className="adm-btn is-small" onClick={() => bulk("reject")}>
                  Reject
                </button>
              )}
              <button type="button" className="adm-btn is-small is-danger" onClick={() => bulk("delete")}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <ul className="adm-comments">
        {comments.map((c) => (
          <li key={c.id} className="adm-card adm-comment">
            <input type="checkbox" aria-label={`Select comment by ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <div className="adm-comment-main">
              {editing?.id === c.id ? (
                <form
                  className="adm-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    patch(c.id, { name: editing.name, body: editing.body });
                  }}
                >
                  <input className="adm-input" aria-label="Name" maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <textarea className="adm-input" aria-label="Comment" maxLength={500} rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                  <div className="adm-actions">
                    <button type="submit" className="adm-btn is-primary is-small">
                      Save changes
                    </button>
                    <button type="button" className="adm-btn is-small" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="adm-comment-head">
                    <strong>{c.name}</strong>
                    <span className="adm-muted">{timeAgo(parseCreated(c.created_at))}</span>
                    {c.edited_at && <span className="adm-muted">edited by you</span>}
                    {c.author && <span className="adm-tag" title="Comments with the same tag come from the same browser">visitor {c.author}</span>}
                    {c.blocked && <span className="adm-tag is-bad">blocked</span>}
                  </div>
                  <p className="adm-comment-body">{c.body}</p>
                  <div className="adm-actions">
                    {c.status !== "approved" && (
                      <button type="button" className="adm-btn is-small is-primary" onClick={() => patch(c.id, { status: "approved" })}>
                        Approve
                      </button>
                    )}
                    {c.status !== "rejected" && (
                      <button type="button" className="adm-btn is-small" onClick={() => patch(c.id, { status: "rejected" })}>
                        Reject
                      </button>
                    )}
                    <button type="button" className="adm-btn is-small" onClick={() => setEditing({ id: c.id, name: c.name, body: c.body })}>
                      Edit
                    </button>
                    {c.author && (
                      <button type="button" className="adm-btn is-small" onClick={() => patch(c.id, { blockAuthor: !c.blocked })}>
                        {c.blocked ? "Unblock visitor" : "Block visitor"}
                      </button>
                    )}
                    <button type="button" className="adm-btn is-small is-danger" onClick={() => remove(c)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
        {!comments.length && <li className="adm-empty">{EMPTY[status]}</li>}
      </ul>
      {data.hasMore && <p className="adm-hint">Showing the newest 100. Clear some to see older ones.</p>}

      <details className="adm-card">
        <summary>Recent moderation activity</summary>
        <ul className="adm-activity">
          {data.activity.map((a) => (
            <li key={a.id}>
              <span>
                {ACTIVITY_LABEL[a.action] ?? a.action}
                {a.detail ? ` ${a.action === "comment.settings" ? `(${a.detail})` : a.detail}` : ""}
              </span>
              <span className="adm-muted">{timeAgo(a.created_at)}</span>
            </li>
          ))}
          {!data.activity.length && <li className="adm-muted">Nothing yet.</li>}
        </ul>
      </details>
    </div>
  );
}
