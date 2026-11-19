import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";
import { isBlocked } from "@/lib/admin/store";
import { BODY_MAX, cleanText, EMAIL_MAX, isEmail, messagesDb, NAME_MAX } from "@/lib/messages";
import { findSection, WidgetError } from "@/lib/widget-data";
import { messageNotice } from "@/lib/notify";
import { notifyAdmin } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/** One message per visitor per 30 s… */
const VISITOR_INTERVAL_MS = 30 * 1000;
/** …and at most this many from everyone together per window, since a new cookie is a new visitor. */
const GLOBAL_LIMIT = 30;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;

const lastByVisitor = new Map<string, number>();
let recent: number[] = [];

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** Body `{ id, name, email?, body, website? }`. `id` is the contact widget's section id. */
export async function POST(request: Request) {
  try {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw) return error("Invalid request body.", 400);
    const section = findSection(typeof raw.id === "string" ? raw.id : null, "contact");

    let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    if (!visitorId) visitorId = generateVisitorId();
    const hashedId = hashVisitorId(visitorId);

    const ok = () => {
      const response = NextResponse.json({ ok: true }, { status: 201 });
      response.cookies.set(COOKIE_NAME, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
      return response;
    };

    // Honeypot: a field people never see. A bot that fills it is told it worked, and nothing is stored.
    if (typeof raw.website === "string" && raw.website.trim()) return ok();

    if (isBlocked(hashedId)) return error("Sending messages is not available.", 403);

    const now = Date.now();
    if (now - (lastByVisitor.get(hashedId) ?? 0) < VISITOR_INTERVAL_MS) return error("Please wait a little before sending another message.", 429);
    recent = recent.filter((t) => now - t < GLOBAL_WINDOW_MS);
    if (recent.length >= GLOBAL_LIMIT) return error("Too many messages right now. Please try again later.", 429);

    const name = typeof raw.name === "string" ? cleanText(raw.name, NAME_MAX + 1) : "";
    const body = typeof raw.body === "string" ? cleanText(raw.body, BODY_MAX + 1, true) : "";
    const email = typeof raw.email === "string" ? cleanText(raw.email, EMAIL_MAX + 1) : "";

    if (!name || !body) return error("Please fill in your name and a message.", 400);
    if (name.length > NAME_MAX || body.length > BODY_MAX) return error(`The name can be up to ${NAME_MAX} characters and the message up to ${BODY_MAX}.`, 400);
    if (section.askEmail === "required" && !email) return error("Please add your email address so I can reply.", 400);
    if (email && section.askEmail !== "hidden" && !isEmail(email)) return error("That email address doesn't look right.", 400);

    const storedEmail = section.askEmail !== "hidden" && email ? email : null;
    messagesDb()
      .prepare("INSERT INTO messages (section_id, name, email, body, created_at, visitor_hash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(section.id, name, storedEmail, body, now, hashedId);
    notifyAdmin(messageNotice({ name, email: storedEmail, body }));
    lastByVisitor.set(hashedId, now);
    recent.push(now);
    return ok();
  } catch (err) {
    if (err instanceof WidgetError) return error(err.message, err.status);
    console.error(`[${new Date().toISOString()}] [Contact] Error:`, err);
    return error("Your message could not be saved. Please try again later.", 500);
  }
}
