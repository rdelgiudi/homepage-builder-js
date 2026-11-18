/** Count-up helpers for the `stats` widget (pure, unit-tested). */

export interface CountParts {
  prefix: string;
  /** The number to count to. */
  target: number;
  decimals: number;
  /** Thousands separator as typed ("," / "." / " " / ""). */
  group: string;
  /** Decimal mark as typed. */
  point: string;
  suffix: string;
}

/**
 * Splits "2,400 h", "$1.5k", "98%", "#1" into prefix, number and suffix. Null when there
 * is no number to animate. The separators are kept as typed, so "2.400" (European) and
 * "2,400" both count up to 2400 and display the same way they were written.
 */
export function parseCount(value: string): CountParts | null {
  const m = /^(\D*?)(\d{1,3}(?:([,. '])\d{3})+|\d+)(?:([.,])(\d+))?([\s\S]*)$/.exec(value);
  if (!m) return null;
  const [, prefix, intPart, group = "", point = "", fraction = "", suffix] = m;
  const digits = group ? intPart.split(group).join("") : intPart;
  const target = Number(`${digits}${fraction ? `.${fraction}` : ""}`);
  if (!Number.isFinite(target)) return null;
  return { prefix, target, decimals: fraction.length, group, point: point || ".", suffix };
}

/** The value with the number replaced by `n`, formatted like the original. */
export function formatCount(parts: CountParts, n: number): string {
  const fixed = n.toFixed(parts.decimals);
  const [int, frac] = fixed.split(".");
  const grouped = parts.group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, parts.group) : int;
  return `${parts.prefix}${grouped}${frac ? `${parts.point}${frac}` : ""}${parts.suffix}`;
}
