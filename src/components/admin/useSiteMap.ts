"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { allSections, markdownLinks, siteMap, type SiteMap } from "@/lib/pages";
import { api } from "./api";

/** Links found in each markdown file (shared by every user of the hook; cleared by the Content screen). */
let cache = new Map<string, Promise<string[]>>();

/** Mounted maps, told to re-read when files change. */
const listeners = new Set<() => void>();

/** The Content screen calls this after saving, moving or deleting files. */
export function forgetFileLinks() {
  cache = new Map();
  listeners.forEach((l) => l());
}

const linksOf = (file: string) => {
  let hit = cache.get(file);
  if (!hit) {
    hit = api<{ content: string }>(`content?file=${encodeURIComponent(file)}`)
      .then((d) => markdownLinks(d.content))
      .catch(() => []);
    cache.set(file, hit);
  }
  return hit;
};

/**
 * The site map of `config` (lib/pages.ts `siteMap`): which pages link where and which can't be
 * reached from the homepage. Links inside the markdown files that Markdown widgets show count
 * too; those files are read through the admin API. Full addresses on this host count as well.
 */
export function useSiteMap(config: HomepageConfig): SiteMap {
  const files = useMemo(
    () => [...new Set(allSections(config).flatMap((s) => (s.type === "markdown" && (s as { file?: string }).file ? [(s as { file: string }).file] : [])))].sort(),
    [config]
  );
  const key = files.join("\n");
  const [fileLinks, setFileLinks] = useState<Record<string, string[]>>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all(files.map(async (f) => [f, await linksOf(f)] as const)).then((entries) => live && setFileLinks(Object.fromEntries(entries)));
    return () => {
      live = false;
    };
    // `key` stands for `files`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  const host = typeof window === "undefined" ? "" : window.location.host.toLowerCase();
  return useMemo(() => siteMap(config, fileLinks, host ? [host] : []), [config, fileLinks, host]);
}
