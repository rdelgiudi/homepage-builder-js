/**
 * Single source of truth for homepage.json (config v2).
 * Types are inferred from these schemas; defaults live here and nowhere else.
 */
import { z } from "zod";
import { SectionSchema } from "@/widgets/meta";

export const CONFIG_VERSION = 2;

const GradientSchema = z.array(z.string());

export const SITE_LAYOUTS = ["tabs", "sidebar", "onepage", "bento", "linkinbio", "masonry", "profile"] as const;
export type SiteLayout = (typeof SITE_LAYOUTS)[number];

export const EffectsSchema = z.object({
  gradientBorders: z.boolean().default(true).meta({ title: "Gradient borders on hover" }),
  tabTransitions: z.boolean().default(true).meta({ title: "Tab transitions" }),
  customScrollbar: z.boolean().default(true).meta({ title: "Custom scrollbar" }),
  progressGradient: z.boolean().default(true).meta({ title: "Progress bar gradient", description: "Discord music bar and Steam achievement bars. Off = a plain solid bar" }),
  progressGradientColors: GradientSchema.optional().meta({ title: "Progress bar colors", ui: "gradient", description: "Falls back to the title gradient" }),
  progressAnimation: z.boolean().default(true).meta({ title: "Animate progress bar gradient", description: "The colors slowly shift along the Discord music bar" }),
  progressSparkles: z.boolean().default(true).meta({ title: "Progress bar sparkles", description: "Sparks at the current position of the Discord music bar" }),
  widgetFrame: z.boolean().default(false).meta({ title: "Gradient frame around widgets" }),
  widgetFrameWidth: z.number().min(0).max(20).default(2).meta({ title: "Frame width (px)" }),
  mouseTrail: z.boolean().default(false).meta({ title: "Mouse trail" }),
  mouseTrailColors: GradientSchema.optional().meta({ title: "Mouse trail colors", ui: "gradient", description: "Falls back to the title gradient" }),
  faviconAnimation: z.boolean().default(true).meta({ title: "Animated favicon" }),
  reactionFlyer: z.boolean().default(true).meta({ title: "Flying emoji on reactions" }),
});

export const BACKGROUND_TYPES = ["solid", "gradient", "image", "video", "pattern"] as const;
export const PARTICLE_EFFECTS = ["none", "stars", "comet", "snow", "fireflies", "constellation", "aurora"] as const;
export type ParticleEffect = (typeof PARTICLE_EFFECTS)[number];

/** `showIf` (read by the admin form generator): show the field only for these background types. */
const only = (...types: (typeof BACKGROUND_TYPES)[number][]) => ({ showIf: { type: types } });

/**
 * What fills the page. One flat object for every type, so switching type in the admin
 * panel keeps the other types' values. Fields that don't belong to the chosen `type`
 * are ignored. `light` / `dark` are always the page colour underneath (and what shows
 * while an image or video loads).
 */
export const BackgroundBaseSchema = z.object({
  type: z.enum(BACKGROUND_TYPES).default("solid").meta({ title: "Background" }),
  light: z.string().default("#f3f4f6").meta({ title: "Light mode color", ui: "color" }),
  dark: z.string().default("#111827").meta({ title: "Dark mode color", ui: "color" }),

  gradientLight: z.array(z.string()).optional().meta({ title: "Light mode gradient", ui: "gradient", ...only("gradient") }),
  gradientDark: z.array(z.string()).optional().meta({ title: "Dark mode gradient", ui: "gradient", description: "Empty = same as light mode", ...only("gradient") }),
  angle: z.number().min(0).max(360).default(135).meta({ title: "Gradient angle (°)", ui: "range", ...only("gradient") }),
  animated: z.boolean().default(false).meta({ title: "Drift slowly", ...only("gradient") }),

  image: z.string().optional().meta({ title: "Image", ui: "image", ...only("image") }),
  imageDark: z.string().optional().meta({ title: "Dark mode image", ui: "image", description: "Empty = same image in both modes", ...only("image") }),
  fit: z.enum(["cover", "contain", "tile"]).default("cover").meta({ title: "Image size", ...only("image") }),
  position: z.enum(["center", "top", "bottom", "left", "right"]).default("center").meta({ title: "Image position", ...only("image") }),
  fixed: z.boolean().default(true).meta({ title: "Stay in place while scrolling", description: "Off = the image is stretched over the whole page and scrolls with it", ...only("image", "pattern") }),

  video: z.string().optional().meta({ title: "Video", ui: "video", description: "Plays muted in a loop", ...only("video") }),
  poster: z.string().optional().meta({ title: "Still image", ui: "image", description: "Shown while the video loads, and instead of it for visitors who prefer reduced motion", ...only("video") }),

  pattern: z.enum(["dots", "grid", "diagonal", "noise"]).default("dots").meta({ title: "Pattern", ...only("pattern") }),
  patternSize: z.number().min(8).max(80).default(24).meta({ title: "Pattern size (px)", ...only("pattern") }),
  patternColor: z.string().optional().meta({ title: "Pattern color", ui: "color", description: "Empty = a faint tone that suits each mode", ...only("pattern") }),
});

export const BackgroundSchema = z.object({
  base: BackgroundBaseSchema.prefault({}),
  /** Applied on top of a gradient, image, video or pattern to keep text readable. */
  overlay: z
    .object({
      dim: z.number().min(0).max(95).default(0).meta({ title: "Fade toward the page color (%)", description: "Darkens the background in dark mode and lightens it in light mode" }),
      blur: z.number().min(0).max(24).default(0).meta({ title: "Blur (px)" }),
    })
    .prefault({}),
  /** Animated layer drawn over the base. */
  effect: z
    .object({
      type: z.enum(PARTICLE_EFFECTS).default("stars").meta({ title: "Particle effect" }),
      density: z.number().min(0.25).max(3).default(1).meta({ title: "Amount", description: "1 = normal" }),
      speed: z.number().min(0.25).max(3).default(1).meta({ title: "Speed", description: "1 = normal" }),
      color: z.string().optional().meta({ title: "Color", ui: "color", description: "Empty = each effect's own colors" }),
    })
    .prefault({}),
  /** How see-through the page's own surfaces are, so a background can show through. */
  surface: z
    .object({
      header: z.number().min(0).max(100).default(100).meta({ title: "Header and tab bar opacity (%)" }),
      cards: z.number().min(20).max(100).default(100).meta({ title: "Widget card opacity (%)" }),
      blur: z.number().min(0).max(24).default(0).meta({ title: "Blur behind the tab bar (px)" }),
    })
    .prefault({}),
});

export const LayoutSchema = z.object({
  /**
   * Site shell (see src/components/SitePage.tsx):
   * `tabs` top tab bar · `sidebar` name + navigation in a left column · `onepage` every tab
   * stacked on one scrolling page · `bento` wide page, widgets in a grid · `linkinbio` narrow column ·
   * `masonry` widgets in staggered columns · `profile` one tab as a sticky column beside the others.
   * What each layout does with the tabs' own settings: src/lib/layouts.ts.
   */
  site: z.enum(SITE_LAYOUTS).default("tabs").meta({ title: "Site layout" }),
  bentoColumns: z
    .number()
    .int()
    .min(2)
    .max(4)
    .default(2)
    .meta({ title: "Widgets per row", description: "For widgets without a width of their own. Each tab's widgets can still be made wider or narrower", showIf: { site: ["bento"] } }),
  masonryColumns: z
    .number()
    .int()
    .min(2)
    .max(3)
    .default(3)
    .meta({ title: "Columns", description: "On wide screens; fewer on smaller ones, one on phones", showIf: { site: ["masonry"] } }),
  fullWidth: z.boolean().default(false).meta({ title: "Use the full screen width", description: "Off = the page stops growing at 1280px, like the other layouts", showIf: { site: ["bento", "masonry"] } }),
  pinnedTab: z
    .string()
    .optional()
    .meta({ title: "Tab shown in the column", ui: "tab", description: "Its widgets stay beside the other tabs, e.g. a profile card and socials. Not set = no column", showIf: { site: ["profile"] } }),
  mobileNav: z
    .enum(["menu", "bottom"])
    .default("menu")
    .meta({
      title: "Tabs on phones",
      labels: { menu: "Menu button", bottom: "Bar at the bottom" },
      description: "Bar at the bottom = every tab one tap away, within thumb reach",
      showIf: { site: ["tabs", "sidebar", "bento", "masonry", "profile"] },
    }),
  sectionHeadings: z
    .boolean()
    .default(true)
    .meta({ title: "Tab names as section headings", description: "Each section starts with its tab's icon and name. Off = only the jump bar names them", showIf: { site: ["onepage"] } }),
});

export const CountersSchema = z.object({
  viewers: z.boolean().default(true).meta({ title: "Show live viewer count" }),
  visitors: z.boolean().default(true).meta({ title: "Show total visitor count" }),
});

export const TabSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).meta({ title: "Label" }),
  icon: z.string().optional().meta({ title: "Icon", ui: "icon", description: "Emoji or image URL" }),
  invertDark: z.boolean().optional().meta({ title: "Invert icon in dark mode" }),
  /** `stack` — one widget per row. `grid` — 12 columns; each widget's `span` sets its width. */
  layout: z.enum(["stack", "grid"]).default("stack").meta({ title: "Arrange widgets", description: "Grid lets widgets sit side by side; set each widget's width in its settings" }),
  /** Replaces `background.base` while this tab is open (not in the one-page layout). */
  background: BackgroundBaseSchema.optional().meta({ title: "Own background for this tab" }),
  sections: z.array(SectionSchema).default([]),
});

/** Name and tagline: the site's (top level) or one page's own (`settings.header`). */
const headerFields = {
  name: z.string().default("Homepage").meta({ title: "Site name" }),
  tagline: z.string().default("Welcome").meta({ title: "Tagline" }),
};
/** Title colors: the site's (top level) or one page's own (`settings.titleColors`). */
const titleColorFields = {
  titleGradient: GradientSchema.default([]).meta({ title: "Title gradient", ui: "gradient", description: "Empty = solid color" }),
  taglineGradient: GradientSchema.default([]).meta({ title: "Tagline gradient", ui: "gradient", description: "Empty = same as title" }),
};

/**
 * Settings one page can have of its own (the homepage too, as `homeSettings`). Each group is
 * all or nothing: missing = the page uses the site's, present = it replaces the site's for that
 * page. `header` and `titleColors` are top-level fields on the site (name/tagline, the two
 * gradients) and nested objects here. The favicon is the same on every page.
 */
export const PageSettingsSchema = z.object({
  header: z.object(headerFields).optional(),
  titleColors: z.object(titleColorFields).optional(),
  layout: LayoutSchema.optional(),
  counters: CountersSchema.optional(),
  background: BackgroundSchema.optional(),
  effects: EffectsSchema.optional(),
});
/** The setting groups a page can have of its own, in the order the panel shows them. */
export const PAGE_SETTING_GROUPS = ["header", "titleColors", "layout", "counters", "background", "effects"] as const;
export type PageSettingGroup = (typeof PAGE_SETTING_GROUPS)[number];

/** One path segment: lowercase letters, digits and dashes. */
export const PAGE_SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/;
/**
 * Addresses a page can't have. Anything starting with `admin` or `api` because the
 * recommended reverse proxy routes by path *prefix* (`/adminfoo` would reach the admin
 * container), and the site's own top-level routes.
 */
export const isReservedSlug = (slug: string) => /^(admin|api)/.test(slug) || ["posts", "overlay", "ws"].includes(slug);

/**
 * An extra page of the site at `/<slug>`, with its own tabs and widgets. The homepage is the
 * top-level `tabs`; name, layout, background and effects are shared by every page.
 */
export const PageSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(PAGE_SLUG, "Use lowercase letters, numbers and dashes, starting with a letter or number")
    .refine((s) => !isReservedSlug(s), "This address is taken by the site itself (anything starting with admin or api, and posts, overlay, ws)")
    .meta({ title: "Address", description: "The page is at /<address>. Lowercase letters, numbers and dashes" }),
  title: z.string().min(1).meta({ title: "Title", description: "Shown in the browser tab and in the editor's site map" }),
  description: z.string().optional().meta({ title: "Description", ui: "textarea", description: "For search engines and link previews. Empty = the site's tagline" }),
  tabs: z.array(TabSchema).default([]),
  /** This page's own layout / counters / background / effects (see PageSettingsSchema). */
  settings: PageSettingsSchema.optional(),
});

export const ConfigSchema = z.object({
  version: z.literal(CONFIG_VERSION),
  ...headerFields,
  favicon: z.string().default("").meta({ title: "Favicon URL", description: "Empty = animated gradient ring" }),
  ...titleColorFields,
  layout: LayoutSchema.prefault({}),
  background: BackgroundSchema.prefault({}),
  effects: EffectsSchema.prefault({}),
  counters: CountersSchema.prefault({}),
  /** The homepage's tabs. */
  tabs: z.array(TabSchema).default([]),
  /** More pages, each at `/<slug>` (see PageSchema). */
  pages: z.array(PageSchema).default([]),
  /** The homepage's own settings, where it differs from the site's (see PageSettingsSchema). */
  homeSettings: PageSettingsSchema.optional(),
});

export type HomepageConfig = z.infer<typeof ConfigSchema>;
export type EffectsConfig = z.infer<typeof EffectsSchema>;
export type BackgroundConfig = z.infer<typeof BackgroundSchema>;
export type BackgroundBase = z.infer<typeof BackgroundBaseSchema>;
export type LayoutConfig = z.infer<typeof LayoutSchema>;
export type CountersConfig = z.infer<typeof CountersSchema>;
export type Tab = z.infer<typeof TabSchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageSettings = z.infer<typeof PageSettingsSchema>;
