/**
 * Weekly schedule maths for the `schedule` widget (pure, unit-tested). Slots are wall-clock
 * times in the owner's time zone; visitors see them converted to their own.
 */
import { zonedTimeToMs, zoneOffsetMinutes } from "../time";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Slot {
  days: Weekday[];
  /** "HH:mm" in the owner's time zone. */
  time: string;
  /** Minutes; 0 = no end time. */
  duration: number;
  label: string;
}

export interface Occurrence {
  slot: number;
  start: number;
  end: number;
  /** True while the slot is running (needs a duration). */
  live: boolean;
}

/** JS day number (0 = Sunday) for a weekday key. */
const jsDay = (d: Weekday) => (WEEKDAYS.indexOf(d) + 1) % 7;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Every slot's occurrences from now (or still running) until a week ahead, soonest first.
 * Each slot/day appears once — the next time it happens. Invalid times or zones are skipped.
 */
export function upcoming(slots: Slot[], timeZone: string, now: number): Occurrence[] {
  let offset: number;
  try {
    offset = zoneOffsetMinutes(now, timeZone);
  } catch {
    return [];
  }
  // Today's date on the owner's wall clock.
  const today = new Date(now + offset * 60000);
  const out: Occurrence[] = [];
  slots.forEach((slot, index) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time)) return;
    const wanted = new Set(slot.days.map(jsDay));
    const length = Math.max(0, slot.duration) * 60000;
    // Yesterday covers a slot that started before midnight and is still running.
    for (let k = -1; k <= 7; k++) {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + k));
      if (!wanted.has(date.getUTCDay())) continue;
      const start = zonedTimeToMs(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${slot.time}`, timeZone);
      if (start === null) continue;
      const end = start + length;
      const live = length > 0 && start <= now && now < end;
      if (!live && start < now) continue;
      if (start - now > 7 * 86400000) continue;
      out.push({ slot: index, start, end, live });
      wanted.delete(date.getUTCDay());
    }
  });
  return out.sort((a, b) => a.start - b.start);
}
