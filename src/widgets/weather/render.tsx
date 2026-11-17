import { DataCard, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { WeatherSection } from "./meta";

interface WeatherData {
  temperature: number;
  feelsLike: number;
  code: number;
  wind: number;
  isDay: boolean;
  unit: string;
  windUnit: string;
  days: { date: string; max: number; min: number; code: number }[];
}

/** WMO weather codes (what Open-Meteo returns) → words and an icon. */
function describe(code: number, isDay = true): { text: string; icon: string } {
  if (code === 0) return { text: "Clear", icon: isDay ? "☀️" : "🌙" };
  if (code <= 2) return { text: "Partly cloudy", icon: isDay ? "🌤️" : "☁️" };
  if (code === 3) return { text: "Overcast", icon: "☁️" };
  if (code <= 48) return { text: "Fog", icon: "🌫️" };
  if (code <= 57) return { text: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { text: "Rain", icon: "🌧️" };
  if (code <= 77) return { text: "Snow", icon: "🌨️" };
  if (code <= 82) return { text: "Showers", icon: "🌧️" };
  if (code <= 86) return { text: "Snow showers", icon: "🌨️" };
  return { text: "Thunderstorm", icon: "⛈️" };
}

function Weather({ section }: { section: WeatherSection }) {
  const ready = section.latitude !== undefined && section.longitude !== undefined;
  const state = useWidgetData<WeatherData>(ready ? `/api/widgets/weather?lat=${section.latitude}&lon=${section.longitude}&units=${section.units}` : null);
  return (
    <DataCard state={state} setup={!ready && "Set the latitude and longitude in this widget's settings."}>
      {(w) => {
        const now = describe(w.code, w.isDay);
        return (
          <div>
            <div className="flex items-center gap-4">
              <span className="text-5xl" aria-hidden>{now.icon}</span>
              <div className="min-w-0 text-left">
                <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {Math.round(w.temperature)}
                  {w.unit}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  {now.text}
                  {section.place ? ` in ${section.place}` : ""}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Feels like {Math.round(w.feelsLike)}
                  {w.unit}, wind {Math.round(w.wind)} {w.windUnit}
                </p>
              </div>
            </div>
            {section.showForecast && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {w.days.slice(1, 4).map((day) => (
                  <div key={day.date} className="rounded-lg bg-gray-100 dark:bg-gray-800 py-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</p>
                    <p className="text-xl" title={describe(day.code).text}>{describe(day.code).icon}</p>
                    <p className="text-sm tabular-nums text-gray-800 dark:text-gray-200">
                      {Math.round(day.max)}° <span className="text-gray-400 dark:text-gray-500">{Math.round(day.min)}°</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<WeatherSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Weather section={section} />,
};
