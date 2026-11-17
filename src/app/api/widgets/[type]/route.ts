import { NextResponse } from "next/server";
import { WidgetError } from "@/lib/widget-data";
import { widgetSources } from "@/lib/widget-sources";

export const dynamic = "force-dynamic";

/** Data for a widget that shows something from another site (weather, feeds, profiles…). */
export async function GET(request: Request, ctx: { params: Promise<{ type: string }> }) {
  const source = widgetSources[(await ctx.params).type];
  if (!source) return NextResponse.json({ error: "Unknown widget." }, { status: 404 });
  try {
    const data = await source(new URL(request.url).searchParams);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (err) {
    if (err instanceof WidgetError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(`[${new Date().toISOString()}] [Widgets] Unexpected error:`, err);
    return NextResponse.json({ error: "Something went wrong loading this widget." }, { status: 500 });
  }
}
