import { z } from "zod";

export const GRID_COLUMNS = 12;

export const AlignSchema = z.enum(["left", "center", "right"]);
export type Align = z.infer<typeof AlignSchema>;

/** Fields every section has. */
export function base<T extends string>(type: T) {
  return {
    id: z.string().min(1),
    type: z.literal(type),
    /**
     * Width in a grid layout, in columns out of 12. Unset = the layout's default
     * (full width in a grid tab, half in the bento layout). Ignored in stack layouts.
     */
    span: z.number().int().min(1).max(GRID_COLUMNS).optional(),
  };
}

export const iconField = z.string().optional().meta({ title: "Icon", ui: "icon", description: "Emoji or image URL" });
export const alignField = AlignSchema.optional().meta({ title: "Alignment" });
export const invertDarkField = z
  .boolean()
  .optional()
  .meta({ title: "Invert icon in dark mode", description: "For monochrome image icons" });

/** Icon + text title row rendered above a widget. */
export const titleFields = {
  icon: iconField,
  text: z.string().optional().meta({ title: "Title" }),
  align: alignField,
  invertDark: invertDarkField,
};

/** Per-section override of `effects.widgetFrame`; unset = inherit the site default. */
export const frameField = {
  widgetFrame: z
    .boolean()
    .optional()
    .meta({ title: "Gradient frame", ui: "tristate", description: "Follows the site-wide setting unless set here" }),
};

/** Per-section progress bar colors (discord-user, steam); unset = `effects.progressGradientColors`, then the title gradient. */
export const progressColorsField = {
  progressColors: z.array(z.string()).optional().meta({
    title: "Progress bar colors",
    ui: "gradient",
    description: "Empty = the site's progress bar colors (Effects), else the title gradient",
  }),
};
