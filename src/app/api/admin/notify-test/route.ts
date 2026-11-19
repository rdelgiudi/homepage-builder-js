import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
import { createTestTicket } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/** A single-use ticket for POST /api/notify-test (see lib/notify-admin.ts for why it takes a detour). */
export const POST = withAdmin(async () => NextResponse.json({ ticket: createTestTicket() }));
