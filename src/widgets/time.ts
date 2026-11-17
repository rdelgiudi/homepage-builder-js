/** Time-zone helpers for the clock and countdown widgets (Intl only, no library). */

/** Minutes that `timeZone` is ahead of UTC at the instant `ms`. Throws on an unknown zone. */
export function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(ms);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/**
 * The instant at which clocks in `timeZone` show `local` ("YYYY-MM-DDTHH:mm"), or null if
 * unparsable. Around daylight-saving changes it behaves like JavaScript's own dates
 * (Temporal's "compatible"): a time that occurs twice resolves to the earlier one, and a
 * time that is skipped resolves to the same distance past the jump (02:30 → 03:30).
 */
export function zonedTimeToMs(local: string, timeZone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  try {
    // Offsets in force a day either side cover any single transition near this date.
    const before = zoneOffsetMinutes(asUtc - 86400000, timeZone);
    const after = zoneOffsetMinutes(asUtc + 86400000, timeZone);
    const candidates = [...new Set([before, after])]
      .map((offset) => asUtc - offset * 60000)
      .filter((ms) => zoneOffsetMinutes(ms, timeZone) * 60000 === asUtc - ms)
      .sort((a, b) => a - b);
    // No candidate: the time falls in a gap; read it with the offset from before the jump.
    return candidates[0] ?? asUtc - before * 60000;
  } catch {
    return null;
  }
}
