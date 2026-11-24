"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomepageConfig } from "@/lib/schema/config";
import { contentCandidates, contentLanguages } from "@/lib/i18n/languages";
import { allSections, markdownLinks, siteMap, translationLinks, type SiteMap, type TranslationLinks } from "@/lib/pages";
import { api } from "./api";

/** Links found in each markdown file on disk, and which files there are (shared by every user of the hook). */
let cache = new Map<string, Promise<string[]>>();
let listing: Promise<Set<string>> | null = null;

/** Mounted maps, told to re-read when files change. */
const listeners = new Set<() => void>();

/** After files were saved, moved or deleted (the Content screen), or may have been (publishing). */
export function forgetFileLinks() {
  cache = new Map();
  listing = null;
  listeners.forEach((l) => l());
}

const filesOnDisk = () =>
  (listing ??= api<{ files: { name: string }[] }>("content")
    .then((d) => new Set(d.files.map((f) => f.name)))
    .catch(() => new Set<string>()));

const linksOf = (path: string) => {
  let hit = cache.get(path);
  if (!hit) {
    hit = api<{ content: string }>(`content?file=${encodeURIComponent(path)}`)
      .then((d) => markdownLinks(d.content))
      .catch(() => []);
    cache.set(path, hit);
  }
  return hit;
};

/** One language's links: per markdown file, and which files it has its own version of. */
interface LanguageLinks {
  links: Record<string, string[]>;
  own: Set<string>;
}

/**
 * The site map of `config` (lib/pages.ts `siteMap`): which pages link where and which can't be
 * reached from the homepage. Links inside the markdown files that Markdown widgets show count
 * too; those files are read through the admin API. Full addresses on this host count as well.
 */
export interface CheckedSiteMap extends SiteMap {
  /**
   * The links inside markdown files are still being read. Until then nothing is reported as
   * unreachable or broken: a page linked only from a markdown file would otherwise be flagged
   * for a moment and then unflagged, which looks like a real problem that fixed itself.
   */
  checking: boolean;
  /** Each translation visitors can choose, where its own markdown files cause problems the original doesn't have. */
  translations: TranslationLinks[];
}

export function useSiteMap(config: HomepageConfig, publishedOriginal: string): CheckedSiteMap {
  const files = useMemo(
    () => [...new Set(allSections(config).flatMap((s) => (s.type === "markdown" && (s as { file?: string }).file ? [(s as { file: string }).file] : [])))].sort(),
    [config]
  );
  const languages = useMemo(() => contentLanguages(config.languages, publishedOriginal), [config.languages, publishedOriginal]);
  const enabled = config.languages.translations.filter((t) => t.enabled).map((t) => t.code);
  // Everything that decides which file on disk is read: a language switch rebuilds the lists.
  const key = JSON.stringify([files, languages, enabled]);
  const [byLanguage, setByLanguage] = useState<Record<string, LanguageLinks>>({});
  /** What `byLanguage` was read for. A re-read after a save keeps the old answer meanwhile. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  useEffect(() => {
    if (!files.length) return;
    let live = true;
    const read = async (code: string, disk: Set<string>): Promise<[string, LanguageLinks]> => {
      const own = new Set<string>();
      const links = await Promise.all(
        files.map(async (file) => {
          // Found here, not by the server: its copy of the draft is half a second behind.
          const path = contentCandidates(file, languages, code).find((c) => disk.has(c));
          if (path?.startsWith(`${code}/`)) own.add(file);
          return [file, path ? await linksOf(path) : []] as const;
        })
      );
      return [code, { links: Object.fromEntries(links), own }];
    };
    filesOnDisk()
      .then((disk) => Promise.all([languages.original, ...enabled].map((code) => read(code, disk))))
      .then((entries) => {
        if (!live) return;
        setByLanguage(Object.fromEntries(entries));
        setLoadedFor(key);
      });
    return () => {
      live = false;
    };
    // `key` stands for `files`, `languages` and `enabled`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  const host = typeof window === "undefined" ? "" : window.location.host.toLowerCase();
  // No markdown files: nothing to wait for.
  const checking = files.length > 0 && loadedFor !== key;
  return useMemo(() => {
    const hosts = host ? [host] : [];
    const map = siteMap(config, byLanguage[config.languages.original]?.links, hosts);
    // Still reading files: report nothing yet (every page counts as reachable meanwhile).
    if (checking) return { ...map, unreachable: [], broken: [], reachable: new Set(map.pages.map((p) => p.slug)), checking, translations: [] };
    const translations = config.languages.translations.flatMap((t) => {
      const found = byLanguage[t.code];
      if (!t.enabled || !found?.own.size) return [];
      const problems = translationLinks(map, siteMap(config, found.links, hosts), t.code, found.own);
      return problems.unreachable.length || problems.broken.length ? [problems] : [];
    });
    return { ...map, checking, translations };
  }, [config, byLanguage, host, checking]);
}
