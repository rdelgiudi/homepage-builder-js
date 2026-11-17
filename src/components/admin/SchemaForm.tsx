"use client";

import { useEffect, useState } from "react";
import type { JsonSchema } from "./schemas";
import { api, uploadFile } from "./api";

type Obj = Record<string, unknown>;

// Identity fields are managed by the builder, never edited by hand. (A section's `type`
// is a constant in its schema, and constants are skipped anyway.)
// `span` (grid width) has its own control in the builder, shown only where a grid applies.
const HIDDEN_KEYS = new Set(["id", "version", "span"]);

function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Sets or (for `undefined`) removes a key, returning a new object. */
function withKey(obj: Obj, key: string, value: unknown): Obj {
  const next = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

interface FormProps {
  schema: JsonSchema;
  value: Obj;
  onChange: (value: Obj) => void;
}

/** Renders a control for every property of an object schema. */
export default function SchemaForm({ schema, value, onChange }: FormProps) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return (
    <div className="adm-form">
      {Object.entries(props).map(([key, node]) => {
        if (HIDDEN_KEYS.has(key) || node.const !== undefined) return null;
        // `showIf`: only relevant for certain values of a sibling (falling back to its default).
        const hidden = Object.entries(node.showIf ?? {}).some(([sibling, allowed]) => !allowed.includes(value?.[sibling] ?? props[sibling]?.default));
        if (hidden) return null;
        return (
          <Field
            key={key}
            name={key}
            node={node}
            // A field is optional when it may be absent and has no default to fall back to.
            optional={!required.has(key) && node.default === undefined}
            value={value?.[key]}
            onChange={(v) => onChange(withKey(value ?? {}, key, v))}
          />
        );
      })}
    </div>
  );
}

interface FieldProps {
  name: string;
  node: JsonSchema;
  optional: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

function Field({ name, node, optional, value, onChange }: FieldProps) {
  const label = node.title ?? humanize(name);
  const current = value === undefined ? node.default : value;

  // Nested object: a titled group of its own fields.
  if (node.type === "object") {
    const visible = Object.entries(node.properties ?? {}).filter(([k, n]) => !HIDDEN_KEYS.has(k) && n.const === undefined);
    if (!visible.length) return null;
    // An optional object is switched on and off as a whole; off removes it from the config.
    if (optional) {
      return (
        <fieldset className="adm-group">
          <label className="adm-switch-row">
            <span>
              <span className="adm-label">{label}</span>
              {node.description && <span className="adm-hint">{node.description}</span>}
            </span>
            <input type="checkbox" className="adm-switch" checked={value !== undefined} onChange={(e) => onChange(e.target.checked ? {} : undefined)} />
          </label>
          {value !== undefined && <SchemaForm schema={node} value={value as Obj} onChange={onChange} />}
        </fieldset>
      );
    }
    return (
      <fieldset className="adm-group">
        <legend>{label}</legend>
        <SchemaForm schema={node} value={(current as Obj) ?? {}} onChange={onChange} />
      </fieldset>
    );
  }

  if (node.type === "boolean" && node.ui !== "tristate") {
    return (
      <label className="adm-switch-row">
        <span>
          <span className="adm-label">{label}</span>
          {node.description && <span className="adm-hint">{node.description}</span>}
        </span>
        <input type="checkbox" className="adm-switch" checked={!!current} onChange={(e) => onChange(e.target.checked || !optional ? e.target.checked : undefined)} />
      </label>
    );
  }

  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      <Control node={node} optional={optional} value={current} onChange={onChange} label={label} />
      {node.description && <span className="adm-hint">{node.description}</span>}
    </div>
  );
}

function Control({ node, optional, value, onChange, label }: Omit<FieldProps, "name"> & { label: string }) {
  if (node.type === "boolean") {
    // Tri-state: unset means "follow the site-wide setting".
    return (
      <Segmented
        label={label}
        options={[
          { value: "inherit", label: "Site default" },
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ]}
        value={value === true ? "on" : value === false ? "off" : "inherit"}
        onChange={(v) => onChange(v === "on" ? true : v === "off" ? false : undefined)}
      />
    );
  }

  if (node.enum) {
    const options = node.enum.map((v) => ({ value: v, label: humanize(v) }));
    if (options.length <= 5) {
      return <Segmented label={label} options={options} value={(value as string) ?? ""} onChange={(v) => onChange(v === value && optional ? undefined : v)} />;
    }
    return (
      <select className="adm-input" aria-label={label} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        {optional && <option value="">Default</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (node.type === "number" || node.type === "integer") {
    const span = node.minimum !== undefined && node.maximum !== undefined ? node.maximum - node.minimum : Infinity;
    const bounded = span <= 100 || node.ui === "range";
    // Small ranges (e.g. 0.25–3) need finer steps than whole numbers.
    const step = node.type === "integer" ? 1 : span <= 5 ? 0.05 : span <= 30 ? 0.5 : 1;
    const set = (raw: string) => {
      if (raw === "") return onChange(optional ? undefined : node.default ?? node.minimum ?? 0);
      const n = node.type === "integer" ? parseInt(raw, 10) : parseFloat(raw);
      if (Number.isFinite(n)) onChange(n);
    };
    return (
      <div className="adm-inline">
        {bounded && <input type="range" aria-label={label} min={node.minimum} max={node.maximum} step={step} value={(value as number) ?? node.minimum} onChange={(e) => set(e.target.value)} />}
        <input type="number" className="adm-input adm-input-num" aria-label={label} min={node.minimum} max={node.maximum} step={bounded ? step : "any"} value={(value as number) ?? ""} onChange={(e) => set(e.target.value)} />
      </div>
    );
  }

  if (node.type === "array") {
    const list = Array.isArray(value) ? value : [];
    const set = (next: unknown[]) => onChange(next.length || !optional ? next : undefined);
    if (node.items?.type === "object") return <ObjectList node={node.items} items={list as Obj[]} onChange={set} label={label} />;
    if (node.ui === "gradient") return <GradientEditor colors={list as string[]} onChange={set} />;
    return <StringList items={list as string[]} onChange={set} label={label} />;
  }

  // Strings. An emptied optional string is removed rather than stored as "".
  const text = (value as string) ?? "";
  const set = (v: string) => onChange(v === "" && optional ? undefined : v);

  if (node.ui === "color") return <ColorInput value={text} onChange={set} label={label} />;
  if (node.ui === "date") return <input type="date" className="adm-input" aria-label={label} value={text} onChange={(e) => set(e.target.value)} />;
  if (node.ui === "datetime") return <input type="datetime-local" className="adm-input" aria-label={label} value={text} onChange={(e) => set(e.target.value)} />;
  if (node.ui === "timezone") return <TimezoneInput value={text} onChange={set} label={label} />;
  if (node.ui === "image" || node.ui === "video") return <MediaInput kind={node.ui} value={text} onChange={set} label={label} />;
  if (node.ui === "textarea") return <textarea className="adm-input" aria-label={label} rows={4} value={text} onChange={(e) => set(e.target.value)} />;
  if (node.ui === "content-file") return <ContentFileSelect value={text} onChange={set} label={label} />;
  if (node.ui === "icon") {
    const isUrl = /^https?:\/\//.test(text);
    return (
      <div className="adm-inline">
        <span className="adm-icon-preview" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {isUrl ? <img src={text} alt="" /> : text}
        </span>
        <input className="adm-input" aria-label={label} value={text} placeholder="😀 or https://…" onChange={(e) => set(e.target.value)} />
      </div>
    );
  }
  return <input className="adm-input" aria-label={label} value={text} onChange={(e) => set(e.target.value)} />;
}

function Segmented({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="adm-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

let timezones: string[] | null = null;

/** Free text with suggestions for every time zone the browser knows (e.g. "Europe/Rome"). */
function TimezoneInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    try {
      timezones ??= ["UTC", ...Intl.supportedValuesOf("timeZone")];
    } catch {
      timezones = ["UTC"];
    }
    setZones(timezones);
  }, []);
  return (
    <>
      <input className="adm-input" aria-label={label} list="adm-timezones" value={value} placeholder="Europe/Rome" onChange={(e) => onChange(e.target.value)} />
      <datalist id="adm-timezones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </>
  );
}

/** An image or video: paste a URL or upload a file. Shows what is currently set. */
function MediaInput({ kind, value, onChange, label }: { kind: "image" | "video"; value: string; onChange: (v: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-media">
      {value &&
        (kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="adm-media-preview" src={value} alt="" />
        ) : (
          <video className="adm-media-preview" src={value} muted loop autoPlay playsInline />
        ))}
      <div className="adm-inline">
        <input className="adm-input" aria-label={label} value={value} placeholder="https://… or upload" onChange={(e) => onChange(e.target.value)} />
        <label className={`adm-btn is-small${busy ? " is-busy" : ""}`}>
          {busy ? "Uploading…" : "Upload"}
          <input
            type="file"
            hidden
            disabled={busy}
            accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : "video/mp4,video/webm"}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <button type="button" className="adm-icon-btn" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange("")}>
            ×
          </button>
        )}
      </div>
      {error && <span className="adm-bad">{error}</span>}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="adm-inline">
      <input type="color" className="adm-swatch" aria-label={`${label} picker`} value={HEX.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
      <input className="adm-input" aria-label={label} value={value} placeholder="#rrggbb or any CSS color" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function GradientEditor({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  const setAt = (i: number, c: string) => onChange(colors.map((old, j) => (j === i ? c : old)));
  return (
    <div>
      {colors.length > 0 && <div className="adm-gradient-bar" style={{ backgroundImage: `linear-gradient(90deg, ${colors.length > 1 ? colors.join(", ") : `${colors[0]}, ${colors[0]}`})` }} />}
      <div className="adm-stops">
        {colors.map((c, i) => (
          <span key={i} className="adm-stop">
            <input type="color" className="adm-swatch" aria-label={`Color ${i + 1}`} value={HEX.test(c) ? c : "#000000"} onChange={(e) => setAt(i, e.target.value)} />
            <button type="button" className="adm-stop-x" aria-label={`Remove color ${i + 1}`} onClick={() => onChange(colors.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
        <button type="button" className="adm-btn is-small" onClick={() => onChange([...colors, colors[colors.length - 1] ?? "#60a5fa"])}>
          Add color
        </button>
      </div>
    </div>
  );
}

function StringList({ items, onChange, label }: { items: string[]; onChange: (items: string[]) => void; label: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v) onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="adm-chips">
        {items.map((item, i) => (
          <span key={i} className="adm-chip">
            {item}
            <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="adm-inline">
        <input
          className="adm-input"
          aria-label={`Add to ${label}`}
          value={draft}
          placeholder="Type and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="adm-btn is-small" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

/** Editor for a list of objects (link items, repositories…): one collapsible card per item. */
function ObjectList({ node, items, onChange, label }: { node: JsonSchema; items: Obj[]; onChange: (items: Obj[]) => void; label: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  const add = () => {
    // Required text fields start empty so the item is valid straight away.
    const blank = Object.fromEntries((node.required ?? []).map((k) => [k, ""]));
    onChange([...items, blank]);
    setOpen(items.length);
  };
  const titleOf = (item: Obj) => {
    const first = ["label", "name", "title", "repo"].map((k) => item[k]).find((v) => typeof v === "string" && v);
    return (first as string) || "Untitled";
  };
  const singular = label.replace(/ies$/, "y").replace(/s$/, "").toLowerCase();

  return (
    <div className="adm-list">
      {items.map((item, i) => (
        <div key={i} className="adm-list-item">
          <div className="adm-list-head">
            <button type="button" className="adm-list-title" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span aria-hidden>{open === i ? "▾" : "▸"}</span> {titleOf(item)}
            </button>
            <button type="button" className="adm-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="adm-icon-btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="adm-icon-btn" aria-label={`Remove ${titleOf(item)}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          {open === i && <SchemaForm schema={node} value={item} onChange={(v) => onChange(items.map((old, j) => (j === i ? v : old)))} />}
        </div>
      ))}
      <button type="button" className="adm-btn is-small" onClick={add}>
        Add {singular}
      </button>
    </div>
  );
}

let contentFiles: Promise<string[]> | null = null;

function ContentFileSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    contentFiles ??= api<{ files: { name: string }[] }>("content")
      .then((d) => d.files.map((f) => f.name))
      .catch(() => []);
    contentFiles.then(setFiles);
  }, []);
  const options = files.includes(value) || !value ? files : [value, ...files];
  return (
    <select className="adm-input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">Choose a file…</option>}
      {options.map((f) => (
        <option key={f} value={f}>
          {f}
          {!files.includes(f) && files.length ? " (missing)" : ""}
        </option>
      ))}
    </select>
  );
}

/** Lets the Content screen invalidate the cached file list after creating or deleting a file. */
export function forgetContentFiles() {
  contentFiles = null;
}
