import { z } from "zod";
import { base, titleFields, frameField } from "../fields";
import type { WidgetMeta } from "../types";

export const schema = z.object({
  ...base("contact"),
  ...titleFields,
  ...frameField,
  intro: z.string().optional().meta({ title: "Intro text", ui: "textarea", description: "Shown above the form" }),
  askEmail: z.enum(["optional", "required", "hidden"]).default("optional").meta({ title: "Email address", description: "Ask for one so you can reply" }),
  buttonText: z.string().default("Send message").meta({ title: "Button text" }),
  successText: z.string().default("Thanks! Your message is on its way.").meta({ title: "After sending" }),
});

export type ContactSection = z.infer<typeof schema>;

export const meta = {
  type: "contact",
  label: "Contact form",
  icon: "✉️",
  category: "community",
  description: "Visitors send you a private message; read them in the admin Inbox",
  schema,
  defaults: { askEmail: "optional", buttonText: "Send message", successText: "Thanks! Your message is on its way." },
} satisfies WidgetMeta;
