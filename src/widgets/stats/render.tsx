import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Notice } from "../common";
import { Icon } from "../shared";
import type { WidgetView } from "../types";
import type { StatsSection } from "./meta";
import { formatCount, parseCount } from "./count";

// Full class names so Tailwind generates them.
const COLUMNS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-6" };
const DURATION_MS = 1200;

/**
 * The value, counting up from zero the first time it scrolls into view. The server (and
 * anyone who prefers reduced motion) gets the final value straight away.
 */
function CountUp({ value, enabled }: { value: string; enabled: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const parts = parseCount(value);
    const el = ref.current;
    if (!enabled || !parts || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      setShown(value);
      return;
    }
    let frame = 0;
    const run = () => {
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / DURATION_MS);
        const eased = 1 - (1 - p) ** 3;
        setShown(p < 1 ? formatCount(parts, parts.target * eased) : value);
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    setShown(formatCount(parts, 0));
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, enabled]);

  return (
    // The final value reserves the width, so the layout doesn't jump while counting.
    <span ref={ref} className="inline-grid">
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {value}
      </span>
      <span className="col-start-1 row-start-1" aria-hidden>
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

export const view: WidgetView<StatsSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => {
    const items = section.items.filter((item) => item.value.trim() || item.label.trim());
    if (!items.length) return <Notice>Add a number in this widget&apos;s settings.</Notice>;
    const colors = section.gradient && ctx.titleGradient.length ? ctx.titleGradient : null;
    const numberStyle: CSSProperties | undefined = colors ? { backgroundImage: `linear-gradient(135deg, ${colors.length === 1 ? `${colors[0]}, ${colors[0]}` : colors.join(", ")})` } : undefined;
    const cards = section.style === "cards";
    return (
      <ul className={`grid grid-cols-2 gap-3 ${COLUMNS[section.columns] ?? COLUMNS[3]}`}>
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 text-center ${cards ? "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2b2d31] px-3 py-5" : "py-2"}`}
          >
            {item.icon && <Icon icon={item.icon} className="text-2xl" width={28} height={28} />}
            <p
              className={`max-w-full break-words text-3xl md:text-4xl font-bold tabular-nums ${colors ? "animate-gradient-text" : "text-gray-900 dark:text-white"}`}
              style={numberStyle}
            >
              <CountUp value={item.value} enabled={section.countUp} />
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 break-words">{item.label}</p>
          </li>
        ))}
      </ul>
    );
  },
};
