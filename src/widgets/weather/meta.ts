import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("weather"),
  ...titleFields,
  ...frameField,
  place: z.string().default("").meta({ translate: "name", title: "Place name", description: "Only a label; the coordinates below decide the weather" }),
  latitude: z.number().min(-90).max(90).optional().meta({ title: "Latitude", description: "For example 41.9 for Rome. Right-click a spot in most map apps to copy its coordinates" }),
  longitude: z.number().min(-180).max(180).optional().meta({ title: "Longitude", description: "For example 12.5 for Rome" }),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius").meta({ title: "Units" }),
  showForecast: z.boolean().default(true).meta({ title: "Show the next three days" }),
});

export type WeatherSection = z.infer<typeof schema>;

export const meta = {
  type: "weather",
  label: "Weather",
  icon: "⛅",
  category: "info",
  description: "Current weather and a short forecast (Open-Meteo, no key needed)",
  schema,
  defaults: { place: "", units: "celsius", showForecast: true },
} satisfies WidgetMeta;
