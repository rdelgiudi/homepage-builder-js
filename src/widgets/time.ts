/** Time-zone helpers for the clock and countdown widgets (Intl only, no library). */

/** Minutes that `timeZone` is ahead of UTC at the instant `ms`. Throws on an unknown zone. */
export function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(ms);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The instant at which clocks in `timeZone` show `local` ("YYYY-MM-DDTHH:mm"), or null if unparsable. */
export function zonedTimeToMs(local: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  try {
    // Two passes settle the offset when the first guess lands on the other side of a DST change.
    const first = asUtc - zoneOffsetMinutes(asUtc, timeZone) * 60000;
    return asUtc - zoneOffsetMinutes(first, timeZone) * 60000;
  } catch {
    return null;
  }
}
