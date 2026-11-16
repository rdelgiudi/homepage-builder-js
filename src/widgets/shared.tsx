import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import type { Align } from "./fields";

const alignClasses: Record<Align, string> = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

export function alignClass(align?: Align): string {
  return alignClasses[align || "center"];
}

function isIconUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

export function Icon({ icon, className, width = 24, height = 24, invertDark }: { icon?: string; className?: string; width?: number; height?: number; invertDark?: boolean }) {
  if (!icon) return null;
  if (isIconUrl(icon)) {
    return <Image src={icon} alt="" width={width} height={height} className={`${className || ""}${invertDark ? " dark:invert" : ""}`} unoptimized />;
  }
  return <span className={className}>{icon}</span>;
}

/** The icon + text row shown above titled widgets. Renders nothing when both are empty. */
export function SectionTitle({ icon, text, align, invertDark }: { icon?: string; text?: string; align?: Align; invertDark?: boolean }) {
  if (!icon && !text) return null;
  return (
    <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${alignClass(align)}`}>
      {icon && <Icon icon={icon} className="text-xl" width={24} height={24} invertDark={invertDark} />}
      {text && <span>{text}</span>}
    </p>
  );
}

const DEFAULT_FRAME_GRADIENT = "linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6, #a78bfa, #60a5fa)";

export function WidgetFrame({ enabled, colors, width, children }: { enabled: boolean; colors?: string[]; width?: number; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  const gradient = colors?.length ? `linear-gradient(135deg, ${colors.join(", ")})` : DEFAULT_FRAME_GRADIENT;
  return (
    <div className="gradient-frame rounded-xl overflow-hidden" style={{ "--gf-width": `${width ?? 2}px`, "--gf-gradient": gradient } as CSSProperties}>
      {children}
    </div>
  );
}
