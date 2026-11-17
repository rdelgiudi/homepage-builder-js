"use client";

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "./api";

type Filter = "unread" | "all";

interface Message {
  id: number;
  section_id: string;
  name: string;
  email: string | null;
  body: string;
  created_at: number;
  read_at: number | null;
  author: string | null;
  blocked: boolean;
}

interface ListResponse {
  messages: Message[];
  hasMore: boolean;
  counts: { unread: number; total: number };
}

const EMPTY: Record<Filter, string> = {
  unread: "No unread messages.",
  all: "No messages yet. Add a Contact form widget to a tab so visitors can write to you.",
};

export default function InboxScreen({ onCounts }: { onCounts: (unread: number) => void }) {
  const [filter, setFilter] = useState<Filter>("unread");
  const [data, setData] = useState<ListResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (f: Filter = filter) => {
      try {
        const res = await api<ListResponse>(`messages?filter=${f}`);
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
    setSelected(new Set());
    load(filter);
  }, [filter, load]);

  /** Runs a change, then reloads so the list and counts are the server's truth. */
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setSelected(new Set());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const patch = (id: number, body: Record<string, unknown>) => act(() => api(`messages/${id}`, { method: "PATCH", body }));
  const remove = (m: Message) => window.confirm(`Delete the message from ${m.name}? This can't be undone.`) && act(() => api(`messages/${m.id}`, { method: "DELETE" }));
  const bulk = (action: "read" | "unread" | "delete") => {
    const ids = [...selected];
    if (action === "delete" && !window.confirm(`Delete ${ids.length} message${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    act(() => api("messages", { method: "POST", body: { ids, action } }));
  };

  if (!data) return <div className="adm-center adm-muted">{error ?? "Loading messages…"}</div>;
  const { messages, counts } = data;
  const allSelected = messages.length > 0 && messages.every((m) => selected.has(m.id));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="adm-page">
      <h1>Inbox</h1>
      <p className="adm-hint">Private messages from the Contact form widget. Only you can see them; nothing here is part of the draft.</p>

      {error && <p className="adm-notice is-bad">{error}</p>}

      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>
          Unread <span className={`adm-count${counts.unread ? " is-draft" : ""}`}>{counts.unread}</span>
        </button>
        <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="adm-count">{counts.total}</span>
        </button>
      </div>

      {messages.length > 0 && (
        <div className="adm-bulk">
          <label className="adm-check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(messages.map((m) => m.id)))} />
            {selected.size ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              <button type="button" className="adm-btn is-small" onClick={() => bulk("read")}>
                Mark read
              </button>
              <button type="button" className="adm-btn is-small" onClick={() => bulk("unread")}>
                Mark unread
              </button>
              <button type="button" className="adm-btn is-small is-danger" onClick={() => bulk("delete")}>
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <ul className="adm-comments">
        {messages.map((m) => (
          <li key={m.id} className={`adm-card adm-comment${m.read_at ? "" : " is-unread"}`}>
            <input type="checkbox" aria-label={`Select message from ${m.name}`} checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
            <div className="adm-comment-main">
              <div className="adm-comment-head">
                <strong>{m.name}</strong>
                {m.email && <span className="adm-muted">{m.email}</span>}
                <span className="adm-muted">{timeAgo(m.created_at)}</span>
                {!m.read_at && <span className="adm-tag is-draft">new</span>}
                {m.author && <span className="adm-tag" title="Messages and comments with the same tag come from the same browser">visitor {m.author}</span>}
                {m.blocked && <span className="adm-tag is-bad">blocked</span>}
              </div>
              <p className="adm-comment-body">{m.body}</p>
              <div className="adm-actions">
                {m.email && (
                  <a className="adm-btn is-small is-primary" href={`mailto:${encodeURIComponent(m.email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: your message")}`} onClick={() => !m.read_at && patch(m.id, { read: true })}>
                    Reply by email
                  </a>
                )}
                <button type="button" className="adm-btn is-small" onClick={() => patch(m.id, { read: !m.read_at })}>
                  {m.read_at ? "Mark unread" : "Mark read"}
                </button>
                {m.author && (
                  <button type="button" className="adm-btn is-small" onClick={() => patch(m.id, { blockAuthor: !m.blocked })} title="Blocks both messages and guestbook comments from this browser">
                    {m.blocked ? "Unblock visitor" : "Block visitor"}
                  </button>
                )}
                <button type="button" className="adm-btn is-small is-danger" onClick={() => remove(m)}>
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
        {!messages.length && <li className="adm-empty">{EMPTY[filter]}</li>}
      </ul>
      {data.hasMore && <p className="adm-hint">Showing the newest 100.</p>}
    </div>
  );
}
