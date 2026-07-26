import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = (globalThis as Record<string, unknown>).__serverSnapshots as
      | { getOverwatch?: () => unknown }
      | undefined;
    const data = snap?.getOverwatch?.() ?? null;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: null }, { status: 200 });
  }
}
