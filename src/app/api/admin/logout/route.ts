import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession, getSessionToken, withAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (request) => {
  const token = getSessionToken(request);
  if (token) destroySession(token);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, request);
  return res;
});
