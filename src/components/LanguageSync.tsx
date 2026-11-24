"use client";

import { useEffect } from "react";
import { rememberLanguage } from "./LanguagePicker";

/**
 * Keeps <html lang> in step with the language shown, and remembers a language that came with
 * the address (`?lang=it`, a shared link) so the next pages are in it too; the address is then
 * cleaned, or it would override the picker.
 */
export default function LanguageSync({ lang, preview }: { lang: string; preview: boolean }) {
  useEffect(() => {
    document.documentElement.lang = lang;
    if (preview) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("lang")) return;
    rememberLanguage(lang, false);
    url.searchParams.delete("lang");
    window.history.replaceState(null, "", url);
  }, [lang, preview]);
  return null;
}
