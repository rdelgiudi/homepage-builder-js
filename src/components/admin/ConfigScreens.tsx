"use client";

import type { ReactNode } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import SchemaForm from "./SchemaForm";
import { formSchemas, type JsonSchema } from "./schemas";
import { useAdmin } from "./store";

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
function KeyForm({ name, schema }: { name: "layout" | "counters" | "background" | "effects"; schema: JsonSchema }) {
  const { config, update } = useAdmin();
  return <SchemaForm schema={schema} value={config[name] as Obj} onChange={(v) => update((c) => ({ ...c, [name]: v }))} />;
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
        <KeyForm name="layout" schema={formSchemas.layout} />
      </Block>
      <Block title="Counters">
        <KeyForm name="counters" schema={formSchemas.counters} />
      </Block>
    </>
  );
}

export function BackgroundScreen() {
  return (
    <Block title="Background">
      <KeyForm name="background" schema={formSchemas.background} />
    </Block>
  );
}

export function EffectsScreen() {
  return (
    <Block title="Effects">
      <KeyForm name="effects" schema={formSchemas.effects} />
    </Block>
  );
}
