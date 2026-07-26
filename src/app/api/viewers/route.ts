import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = (globalThis as Record<string, unknown>).__serverSnapshots as
      | { getViewers?: () => number }
      | undefined;
    const count = snap?.getViewers?.() ?? 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
