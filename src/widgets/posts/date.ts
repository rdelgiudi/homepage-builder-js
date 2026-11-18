/** "18 Nov 2026" for a YYYY-MM-DD post date — formatted in UTC so server and browser agree on the day. */
export function postDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
