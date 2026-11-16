import { NextResponse } from "next/server";
import { destroySession, getSessionToken, SESSION_COOKIE, withAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (request) => {
  const token = getSessionToken(request);
  if (token) destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", maxAge: 0, path: "/" });
  return res;
});
