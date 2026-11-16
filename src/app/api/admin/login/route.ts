import { NextResponse } from "next/server";
import { adminEnabled, checkPassword, clearLoginFailures, clientKey, createSession, isSameOrigin, loginThrottle, readJson, recordLoginFailure, setSessionCookie } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const key = clientKey(request);
  const wait = loginThrottle(key);
  if (wait > 0) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429 });
  }

  const body = await readJson<{ password?: unknown }>(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await checkPassword(password))) {
    recordLoginFailure(key);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  clearLoginFailures(key);
  const token = createSession();
  audit("auth.login", key);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, request, token);
  return res;
}
