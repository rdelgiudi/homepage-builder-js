import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { testNotice } from "@/lib/notify";
import { consumeTestTicket, sendNotice } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/**
 * Sends a fixed test notification. Public on purpose — it runs in the container that has the
 * NTFY_* variables — but only with a single-use ticket from /api/admin/notify-test, which needs
 * an admin session. Body `{ ticket }`.
 */
export async function POST(request: Request) {
  const raw = (await request.json().catch(() => null)) as { ticket?: unknown } | null;
  if (!consumeTestTicket(raw?.ticket)) return NextResponse.json({ error: "This test request expired. Please try again." }, { status: 403 });
  const result = await sendNotice(testNotice(getConfig().name));
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
