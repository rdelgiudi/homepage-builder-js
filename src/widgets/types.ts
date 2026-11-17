import type { ReactNode } from "react";
import type { z } from "zod";

export type WidgetCategory = "content" | "media" | "info" | "social" | "gaming" | "community";

/**
 * Server-safe description of a widget: what it is and which options it takes.
 * Lives in `src/widgets/<type>/meta.ts`. Must not import React components —
 * it is used by the config loader and (later) the admin panel's form generator.
 */
export interface WidgetMeta<S extends z.ZodType = z.ZodType> {
  type: string;
  label: string;
  /** Emoji shown in the widget palette. */
  icon: string;
  category: WidgetCategory;
  description: string;
  /** Full section schema, including `id` and the `type` literal. */
  schema: S;
  /** Option values for a freshly added instance (without `id` / `type`). */
  defaults: Record<string, unknown>;
  /** Env vars the widget needs to show real data. */
  requiresEnv?: string[];
}

/** Site-wide values every widget may read. */
export interface WidgetContext {
  gradientBorders: boolean;
  progressGradient: boolean;
  progressGradientColors?: string[];
  titleGradient: string[];
  discordServerId?: string;
  /** Site default for the gradient frame; a section's own `widgetFrame` overrides it. */
  widgetFrame: boolean;
  widgetFrameWidth: number;
}

export interface WidgetRenderContext extends WidgetContext {
  /** Resolved frame state for this section (`section.widgetFrame ?? ctx.widgetFrame`). */
  framed: boolean;
}

/**
 * Client-side half of a widget: how it renders. Lives in `src/widgets/<type>/render.tsx`.
 */
export interface WidgetView<S> {
  /** Render the shared icon + text title row above the widget. */
  titled: boolean;
  /**
   * `wrap` — the shell wraps the body in the gradient frame when enabled.
   * `self` — the widget draws its own frame (reads `ctx.framed`).
   * `none` — the widget is never framed.
   */
  frame: "wrap" | "self" | "none";
  render: (section: S, ctx: WidgetRenderContext) => ReactNode;
}
