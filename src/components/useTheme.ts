"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

// One theme for the whole page: several switches can be on it (the banner has one per place it
// shows at different screen widths), and they must never disagree.
let theme: Theme | null = null;
const listeners = new Set<() => void>();

function current(): Theme {
  if (theme) return theme;
  try {
    theme = localStorage.getItem("theme") === "light" ? "light" : "dark";
  } catch {
    theme = "dark";
  }
  return theme;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function toggleTheme() {
  theme = current() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Storage blocked: the choice lasts until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  // The server renders dark (`<html class="dark">`).
  const value = useSyncExternalStore<Theme>(subscribe, current, () => "dark");

  // Reads `current()`, not `value`: during hydration `value` is briefly the server's.
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(current());
  }, [value]);

  return { theme: value, toggleTheme };
}
