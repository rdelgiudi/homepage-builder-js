import { z } from "zod";

export const AlignSchema = z.enum(["left", "center", "right"]);
export type Align = z.infer<typeof AlignSchema>;

/** Fields every section has. */
export function base<T extends string>(type: T) {
  return {
    id: z.string().min(1),
    type: z.literal(type),
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
