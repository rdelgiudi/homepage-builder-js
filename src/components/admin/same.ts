/**
 * Whether two configs are the same for the draft logic ("has a draft" = differs from live).
 * Key order is ignored: an edit that removes a key and sets it again (a widget's width, an
 * optional field cleared and refilled) puts it at the end of the object, and a plain
 * JSON.stringify comparison then reported a draft with no visible difference.
 * Array order still counts (tabs, widgets, list items). Keys whose value is undefined are
 * ignored, as in JSON.
 */
export function sameConfig(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, canonical(obj[k])])
    );
  }
  return value;
}
