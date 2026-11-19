import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";
import { widgetContextFor } from "@/lib/widget-context";
import OverlayView from "@/components/OverlayView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Stream overlay: one widget of the published site on a transparent background, for an OBS
 * Browser Source (`/overlay/<section id>`, `?theme=light|dark`, `?title=0`). Served by the
 * public container like the site itself.
 */
export default async function OverlayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  // The published config only — never findSection(), which falls back to the admin draft and
  // would show unpublished widgets to anyone who knows an id.
  const section = getConfig().tabs.flatMap((t) => t.sections).find((s) => s.id === id);
  if (!section) notFound();

  // `?title=0`: drop the title row. The keys have to go, not be blanked: renderSection draws
  // a title row (with the brand logo) for any section that has a `text` key.
  const { text: _text, icon: _icon, ...untitled } = section as typeof section & { text?: string; icon?: string };
  const shown = query.title === "0" ? (untitled as typeof section) : section;

  return (
    <>
      {/* In the server HTML, so the source is transparent from the first paint, not after hydration. */}
      <style>{"html,body{background:transparent!important}"}</style>
      <OverlayView section={shown} widgetContext={widgetContextFor(getConfig())} theme={query.theme === "light" ? "light" : "dark"} />
    </>
  );
}
