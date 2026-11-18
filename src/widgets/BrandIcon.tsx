import type { ReactNode } from "react";
import { widgetBrand } from "./brands";

/** A widget type's service logo, or `fallback` (its emoji) when it has none. */
export function WidgetIcon({ type, fallback, size = 18, className }: { type: string; fallback?: ReactNode; size?: number; className?: string }) {
  const brand = widgetBrand(type);
  if (!brand) return <>{fallback}</>;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={brand.color} role="img" aria-label={brand.name} className={`inline-block shrink-0 align-[-0.15em] ${className ?? ""}`}>
      <path d={brand.path} />
    </svg>
  );
}
