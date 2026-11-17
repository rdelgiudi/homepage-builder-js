import { useState, type FormEvent } from "react";
import { Card } from "../common";
import type { WidgetView } from "../types";
import type { ContactSection } from "./meta";

// Keep in step with src/lib/messages.ts (re-checked on the server).
const NAME_MAX = 60;
const EMAIL_MAX = 200;
const BODY_MAX = 4000;

const input =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#1e1f22] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function ContactForm({ section, gradientBorders }: { section: ContactSection; gradientBorders: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: section.id, name, email, body, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
        setBody("");
      } else {
        setError(data.error ?? "Your message could not be sent.");
        setState("idle");
      }
    } catch {
      setError("Your message could not be sent. Check your connection and try again.");
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <Card className="text-center">
        <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{section.successText}</p>
        <button type="button" onClick={() => setState("idle")} className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Send another
        </button>
      </Card>
    );
  }

  return (
    <Card className="text-left">
      {section.intro && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{section.intro}</p>}
      <form onSubmit={submit} className="space-y-3">
        <div className={`grid gap-3 ${section.askEmail === "hidden" ? "" : "sm:grid-cols-2"}`}>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} required autoComplete="name" />
          </label>
          {section.askEmail !== "hidden" && (
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Email{section.askEmail === "optional" && " (optional)"}</span>
              <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX} required={section.askEmail === "required"} autoComplete="email" />
            </label>
          )}
        </div>
        {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored by the server. */}
        <div aria-hidden className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Message</span>
          <textarea className={`${input} resize-y`} rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} required />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
          <button
            type="submit"
            disabled={state === "sending"}
            className={`shrink-0 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-60${gradientBorders ? " gradient-border-card" : ""}`}
          >
            {state === "sending" ? "Sending…" : section.buttonText}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Only the site owner can read your message.</p>
      </form>
    </Card>
  );
}

export const view: WidgetView<ContactSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <ContactForm section={section} gradientBorders={ctx.gradientBorders} />,
};
