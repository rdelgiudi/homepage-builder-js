import { z } from "zod";
import { base, titleFields, frameField, iconField } from "../fields";
import type { WidgetMeta } from "../types";

export const serviceSchema = z.object({
  label: z.string().meta({ translate: "name", title: "Name" }),
  url: z.string().meta({ title: "Address to check", description: "http(s). Visible in the page source to every visitor" }),
  icon: iconField,
});

export const schema = z.object({
  ...base("status"),
  ...titleFields,
  ...frameField,
  services: z.array(serviceSchema).max(20).default([]).meta({ title: "Services", description: "Checked by the server at most once a minute, only while someone is viewing" }),
  showLatency: z.boolean().default(true).meta({ title: "Show response time" }),
  linked: z.boolean().default(false).meta({ title: "Link to the services", description: "Make each name a link to its address" }),
});

export type StatusSection = z.infer<typeof schema>;

export const meta = {
  type: "status",
  label: "Service status",
  icon: "🟢",
  category: "info",
  description: "Up/down and response time for websites and self-hosted services",
  schema,
  defaults: { services: [{ label: "Homepage", url: "https://example.com" }], showLatency: true, linked: false },
} satisfies WidgetMeta;
