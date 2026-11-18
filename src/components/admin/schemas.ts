/**
 * JSON Schema views of the config schema, for the form generator. The admin forms are
 * built from these, so every option in homepage.json gets a control without writing one.
 */
import { z } from "zod";
import { ConfigSchema, TabSchema } from "@/lib/schema/config";
import { widgetMetas } from "@/widgets/meta";

export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  /** Rendering hint set in the zod schema via `.meta({ ui })`. */
  ui?: string;
  /** Show this field only while a sibling field has one of the listed values. */
  showIf?: Record<string, unknown[]>;
  default?: unknown;
  const?: unknown;
  enum?: string[];
  /** Display names for enum values (`.meta({ labels })`); missing ones are humanized. */
  labels?: Record<string, string>;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

const toForm = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input" }) as JsonSchema;

const config = toForm(ConfigSchema);
const pick = (...keys: string[]): JsonSchema => ({
  type: "object",
  properties: Object.fromEntries(keys.map((k) => [k, config.properties![k]])),
});

export const formSchemas = {
  identity: pick("name", "tagline", "favicon"),
  gradients: pick("titleGradient", "taglineGradient"),
  layout: config.properties!.layout,
  counters: config.properties!.counters,
  background: config.properties!.background,
  effects: config.properties!.effects,
  tab: toForm(TabSchema.omit({ sections: true })),
  widgets: Object.fromEntries(widgetMetas.map((m) => [m.type, toForm(m.schema)])) as Record<string, JsonSchema>,
};
