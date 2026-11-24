/**
 * Single source of truth for homepage.json (config v2).
 * Types are inferred from these schemas; defaults live here and nowhere else.
 */
import { z } from "zod";
import { LANGUAGE_CODE } from "@/lib/i18n/languages";
import { MAX_PAGE_DEPTH, PAGE_SLUG, isReservedSlug } from "./page-address";
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

/**
 * The banner at the top of every page: name (or logo), tagline and the tab bar. The defaults are
 * the banner as it always was. What a site layout can't do with it: lib/banner.ts.
 */
const bannerFields = {
  title: z
    .enum(["name", "logo", "both"])
    .default("name")
    .meta({ title: "Title", labels: { name: "Name", logo: "Logo", both: "Logo and name" } }),
  logo: z.string().optional().meta({ title: "Logo", ui: "image", description: "A transparent background works best. Without one the name is shown", showIf: { title: ["logo", "both"] } }),
  logoDark: z.string().optional().meta({ title: "Dark mode logo", ui: "image", description: "Empty = same logo in both modes", showIf: { title: ["logo", "both"] } }),
  logoHeight: z
    .number()
    .int()
    .min(16)
    .max(240)
    .default(64)
    .meta({ title: "Logo height (px)", ui: "range", description: "In one row with the tabs it is at most 64 (40 on phones)", showIf: { title: ["logo", "both"] } }),
  showTagline: z.boolean().default(true).meta({ title: "Show the tagline", description: "Off = only search engines and link previews see it. In one row it is hidden on phones and takes room from the tabs" }),
  /** `stacked` title, tagline, then the tabs · `inline` title and tabs in one row. */
  arrangement: z
    .enum(["stacked", "inline"])
    .default("stacked")
    .meta({ title: "Arrangement", labels: { stacked: "Title above tabs", inline: "One row" } }),
  titlePosition: z.enum(["left", "center", "right"]).default("center").meta({ title: "Title position" }),
  tabsPosition: z.enum(["left", "center", "right"]).default("center").meta({ title: "Tabs position" }),
  fullWidth: z.boolean().default(false).meta({ title: "Use the full screen width", description: "Off = as wide as the page's content" }),
  /** `tabs` the title scrolls away, the tabs stay · `hide` all of it hides scrolling down, returns scrolling up · `all` all of it stays. */
  scroll: z
    .enum(["tabs", "hide", "all"])
    .default("tabs")
    .meta({
      title: "While scrolling",
      labels: { tabs: "Keep tabs", hide: "Hide all", all: "Keep all" },
      description: "Keep tabs = only the title scrolls away. Hide all = the banner leaves when scrolling down and comes back when scrolling up",
    }),
  themeSwitch: z
    .enum(["floating", "banner"])
    .default("floating")
    .meta({ title: "Light/dark switch", labels: { floating: "Floating", banner: "In the banner" }, description: "Floating = fixed at the bottom right of the window" }),
  languagePicker: z
    .enum(["banner", "bottom-right", "bottom-left", "top-right", "top-left", "footer"])
    .default("banner")
    .meta({
      title: "Language picker",
      labels: {
        banner: "In the banner",
        "bottom-right": "Floating, bottom right",
        "bottom-left": "Floating, bottom left",
        "top-right": "Floating, top right",
        "top-left": "Floating, top left",
        footer: "End of the page",
      },
      description: "Shown only while the site is in more than one language",
    }),
};
/** One set of banner settings (the site's, or the phones' own). */
export const BannerOptionsSchema = z.object(bannerFields);
export const BannerSchema = z.object({
  ...bannerFields,
  /** Phones' own settings (below `md`): the whole set, all or nothing. Missing = the same as everywhere. */
  phone: BannerOptionsSchema.optional(),
});

export const CountersSchema = z.object({
  viewers: z.boolean().default(true).meta({ title: "Show live viewer count" }),
  visitors: z.boolean().default(true).meta({ title: "Show total visitor count" }),
});

export const TabSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).meta({ translate: true, title: "Label" }),
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
  name: z.string().default("Homepage").meta({ translate: "name", title: "Site name" }),
  tagline: z.string().default("Welcome").meta({ translate: true, title: "Tagline" }),
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
  banner: BannerSchema.optional(),
  layout: LayoutSchema.optional(),
  counters: CountersSchema.optional(),
  background: BackgroundSchema.optional(),
  effects: EffectsSchema.optional(),
});
/** The setting groups a page can have of its own, in the order the panel shows them. */
export const PAGE_SETTING_GROUPS = ["header", "titleColors", "banner", "layout", "counters", "background", "effects"] as const;
export type PageSettingGroup = (typeof PAGE_SETTING_GROUPS)[number];

// Page address rules live in a zod-free module: lib/pages.ts (in the site's client bundle) uses them too.
export { MAX_PAGE_DEPTH, PAGE_SEGMENT, PAGE_SLUG, isReservedSlug } from "./page-address";

/**
 * An extra page of the site at `/<slug>`, with its own tabs and widgets. The homepage is the
 * top-level `tabs`; name, layout, background and effects are shared by every page.
 */
export const PageSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .regex(PAGE_SLUG, `Use lowercase letters, numbers and dashes, starting with a letter or number; at most ${MAX_PAGE_DEPTH} levels ("about/colophon")`)
    .refine((s) => !isReservedSlug(s), "This address is taken by the site itself (anything starting with admin or api, and posts, overlay, ws)")
    .meta({ title: "Address", description: "The page is at /<address>, e.g. about or about/colophon (under another page). Lowercase letters, numbers and dashes" }),
  title: z.string().min(1).meta({ translate: true, title: "Title", description: "Shown in the browser tab and in the editor's site map" }),
  description: z.string().optional().meta({ translate: true, title: "Description", ui: "textarea", description: "For search engines and link previews. Empty = the site's tagline" }),
  tabs: z.array(TabSchema).default([]),
  /** This page's own settings groups (see PageSettingsSchema). */
  settings: PageSettingsSchema.optional(),
});

/** What was decided for one text in one place. */
export const TextEntrySchema = z.object({
  /** The translation. */
  to: z.string().optional(),
  /** "Doesn't translate": it stays as it is. */
  same: z.boolean().optional(),
  /** The original was edited since: still shown, but should be looked at. */
  check: z.boolean().optional(),
});

/** One translated language. */
export const TranslationSchema = z.object({
  code: z.string().regex(LANGUAGE_CODE, "Use a language code like it or pt-BR"),
  /** Offered to visitors. Off = only in the admin preview. */
  enabled: z.boolean().default(true),
  /**
   * Place → original text → what it is in this language. See lib/i18n/texts.ts for why the text is
   * part of the key, and what a place is. Shorthand for hand-written files: `"Home": "Inizio"`
   * directly in here = every place that has this text now (expanded when the file is read).
   */
  texts: z.record(z.string(), z.record(z.string(), TextEntrySchema)).default({}),
});

export const LanguagesSchema = z.object({
  original: z.string().regex(LANGUAGE_CODE, "Use a language code like en or pt-BR").default("en").meta({ title: "Original language" }),
  detect: z
    .boolean()
    .default(true)
    .meta({ title: "Start in the visitor's language", description: "If their browser asks for a language the site has. Off = always start in the original" }),
  translations: z.array(TranslationSchema).default([]),
});

export const ConfigSchema = z.object({
  version: z.literal(CONFIG_VERSION),
  ...headerFields,
  favicon: z.string().default("").meta({ title: "Favicon URL", description: "Empty = animated gradient ring" }),
  postAuthor: z
    .string()
    .default("")
    .meta({ translate: "name", title: "Default author", description: "Shown on blog posts that don't name their own `author` in their front matter. Empty = no author" }),
  ...titleColorFields,
  banner: BannerSchema.prefault({}),
  layout: LayoutSchema.prefault({}),
  background: BackgroundSchema.prefault({}),
  effects: EffectsSchema.prefault({}),
  counters: CountersSchema.prefault({}),
  /** The original language and the translations (the same on every page). */
  languages: LanguagesSchema.prefault({}),
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
export type BannerConfig = z.infer<typeof BannerSchema>;
export type BannerOptions = z.infer<typeof BannerOptionsSchema>;
export type CountersConfig = z.infer<typeof CountersSchema>;
/** `sourceLabel`: the original label of a tab `localize()` translated (its address stays the same). */
export type Tab = z.infer<typeof TabSchema> & { sourceLabel?: string };
export type LanguagesConfig = z.infer<typeof LanguagesSchema>;
export type Translation = z.infer<typeof TranslationSchema>;
export type TextEntry = z.infer<typeof TextEntrySchema>;
export type Page = z.infer<typeof PageSchema>;
export type PageSettings = z.infer<typeof PageSettingsSchema>;
