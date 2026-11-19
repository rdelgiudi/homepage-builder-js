"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import SchemaForm from "./SchemaForm";
import { formSchemas, type JsonSchema } from "./schemas";
import { useAdmin } from "./store";
import { api } from "./api";
import { LayoutPicker } from "./LayoutControls";

type Obj = Record<string, unknown>;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="adm-panel-head">
        <h2>{title}</h2>
      </div>
      <div className="adm-pad">{children}</div>
    </>
  );
}

/** A form over the top-level keys of the config that `schema` lists. */
function RootForm({ schema }: { schema: JsonSchema }) {
  const { config, update } = useAdmin();
  return <SchemaForm schema={schema} value={config as unknown as Obj} onChange={(v) => update(() => v as unknown as HomepageConfig)} />;
}

/** A form over one nested object of the config. */
function KeyForm({ name, schema, hide }: { name: "layout" | "counters" | "background" | "effects"; schema: JsonSchema; hide?: string[] }) {
  const { config, update } = useAdmin();
  return <SchemaForm schema={schema} value={config[name] as Obj} hide={hide} onChange={(v) => update((c) => ({ ...c, [name]: v }))} />;
}

export function SiteScreen() {
  return (
    <>
      <Block title="Name and tagline">
        <RootForm schema={formSchemas.identity} />
      </Block>
      <Block title="Title colors">
        <RootForm schema={formSchemas.gradients} />
      </Block>
      <Block title="Layout">
        <LayoutPicker />
        {/* The layout's own options (bento: widgets per row, one page: section headings); `site` is the picker above. */}
        <KeyForm name="layout" schema={formSchemas.layout} hide={["site"]} />
      </Block>
      <Block title="Counters">
        <KeyForm name="counters" schema={formSchemas.counters} />
      </Block>
    </>
  );
}

interface Upload {
  name: string;
  url: string;
  kind: "image" | "video";
  bytes: number;
  inUse: boolean;
}

/** Files uploaded for backgrounds, so unused ones can be removed. */
function Uploads() {
  const { savedTick } = useAdmin();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const load = useCallback(() => {
    api<{ uploads: Upload[] }>("upload")
      .then((d) => setUploads(d.uploads))
      .catch(() => {});
  }, []);
  // Refresh whenever the draft was saved: that is when "in use" can change.
  useEffect(load, [load, savedTick]);

  if (!uploads.length) return <p className="adm-hint">Nothing uploaded yet. Choose Image or Video above and use Upload.</p>;
  return (
    <ul className="adm-uploads">
      {uploads.map((u) => (
        <li key={u.name}>
          {u.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.url} alt="" />
          ) : (
            <video src={u.url} muted preload="metadata" />
          )}
          <span className="adm-hint">
            {u.kind === "image" ? "Image" : "Video"}, {u.bytes > 1048576 ? `${(u.bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(u.bytes / 1024))} KB`}
            {u.inUse ? ", in use" : ""}
          </span>
          <button
            type="button"
            className="adm-btn is-small is-danger"
            disabled={u.inUse}
            title={u.inUse ? "Used by the live site or your draft" : undefined}
            onClick={() => api(`upload?name=${u.name}`, { method: "DELETE" }).then(load)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BackgroundScreen() {
  return (
    <>
      <Block title="Background">
        <KeyForm name="background" schema={formSchemas.background} />
      </Block>
      <Block title="Uploaded files">
        <Uploads />
      </Block>
    </>
  );
}

export function EffectsScreen() {
  return (
    <Block title="Effects">
      <KeyForm name="effects" schema={formSchemas.effects} />
    </Block>
  );
}
