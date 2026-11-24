"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HomepageConfig, TextEntry, Translation } from "@/lib/schema/config";
import { COMMON_LANGUAGES, LANGUAGE_CODE, contentLanguages, contentPlace, languageName } from "@/lib/i18n/languages";
import { collectTexts, placeOf, translationStatus, withEntry, type TextRow, type TextUse } from "@/lib/i18n/texts";
import { suggestTranslations } from "@/lib/i18n/suggest";
import { allSections } from "@/lib/pages";
import { widgetMetas } from "@/widgets/meta";
import type { ContentTarget } from "./ContentScreen";
import { useAdmin } from "./store";
import { api } from "./api";

const widgetLabels = new Map(widgetMetas.map((m) => [m.type as string, m.label as string]));
const inEnglish = (code: string) => languageName(code, "en");
/** "Italian (Italiano)", or just the name where both are the same. */
const fullName = (code: string) => (inEnglish(code) === languageName(code) ? inEnglish(code) : `${inEnglish(code)} (${languageName(code)})`);

type Filter = "all" | "missing" | "check" | "done";

/** Every language of the site: the original, the translations, and their texts. Part of the draft. */
export default function LanguagesScreen({ lang, onLang, onOpenFile }: { lang: string; onLang: (code: string) => void; onOpenFile: (target: ContentTarget) => void }) {
  const { config, update } = useAdmin();
  const { languages } = config;
  const { original, translations } = languages;
  // The one being translated is the one the preview shows.
  const active = translations.find((t) => t.code === lang) ?? null;

  const setLanguages = (fn: (l: HomepageConfig["languages"]) => HomepageConfig["languages"]) => update((c) => ({ ...c, languages: fn(c.languages) }));
  const setTranslation = (code: string, fn: (t: Translation) => Translation) =>
    setLanguages((l) => ({ ...l, translations: l.translations.map((t) => (t.code === code ? fn(t) : t)) }));

  const taken = new Set([original, ...translations.map((t) => t.code)]);
  const add = (code: string) => {
    if (!LANGUAGE_CODE.test(code) || taken.has(code)) return;
    setLanguages((l) => ({ ...l, translations: [...l.translations, { code, enabled: true, texts: {} }] }));
    onLang(code);
  };
  const sorted = useMemo(() => [...COMMON_LANGUAGES].sort((a, b) => inEnglish(a).localeCompare(inEnglish(b))), []);

  return (
    <>
      <section className="adm-block">
        <div className="adm-panel-head">
          <h2>Languages</h2>
          <span className="adm-tag">Whole site</span>
        </div>
        <div className="adm-pad adm-form">
          <div className="adm-field">
            <span className="adm-label">Original language</span>
            <select className="adm-input" aria-label="Original language" value={original} onChange={(e) => setLanguages((l) => ({ ...l, original: e.target.value }))}>
              {!COMMON_LANGUAGES.includes(original) && <option value={original}>{fullName(original)}</option>}
              {sorted.map((c) => (
                <option key={c} value={c} disabled={c !== original && taken.has(c)}>
                  {fullName(c)}
                </option>
              ))}
            </select>
            <span className="adm-hint">The language your texts are written in everywhere else in this panel</span>
          </div>

          <div className="adm-field">
            <span className="adm-label">Translations</span>
            {translations.length > 0 && (
              <ul className="adm-langs">
                {translations.map((t) => (
                  <LanguageRow
                    key={t.code}
                    t={t}
                    open={t.code === active?.code}
                    onOpen={() => onLang(t.code === active?.code ? original : t.code)}
                    onEnabled={(enabled) => setTranslation(t.code, (x) => ({ ...x, enabled }))}
                    onRemove={() => {
                      const n = translationStatus(config, t).decided;
                      if (n && !window.confirm(`Remove ${inEnglish(t.code)} and its ${n} translated text${n === 1 ? "" : "s"}? (Undo brings it back.)`)) return;
                      setLanguages((l) => ({ ...l, translations: l.translations.filter((x) => x.code !== t.code) }));
                      if (active?.code === t.code) onLang(original);
                    }}
                  />
                ))}
              </ul>
            )}
            <select className="adm-input" aria-label="Add a language" value="" onChange={(e) => (e.target.value === "other" ? add((window.prompt("Language code, e.g. eo or pt-PT") ?? "").trim()) : add(e.target.value))}>
              <option value="">Add a language…</option>
              {sorted
                .filter((c) => !taken.has(c))
                .map((c) => (
                  <option key={c} value={c}>
                    {fullName(c)}
                  </option>
                ))}
              <option value="other">Other…</option>
            </select>
            <span className="adm-hint">Visitors can choose every language that is switched on; what isn&apos;t translated is shown in {inEnglish(original)}. The picker&apos;s place is under Header &amp; layout → Banner.</span>
          </div>

          {translations.length > 0 && (
            <label className="adm-switch-row">
              <span>
                <span className="adm-label">Start in the visitor&apos;s language</span>
                <span className="adm-hint">If their browser asks for one the site has. Off = always start in {inEnglish(original)}</span>
              </span>
              <input type="checkbox" className="adm-switch" checked={languages.detect} onChange={(e) => setLanguages((l) => ({ ...l, detect: e.target.checked }))} />
            </label>
          )}
        </div>
      </section>

      {active && <Texts key={active.code} t={active} change={(fn) => setTranslation(active.code, fn)} />}
      {active && <Files code={active.code} onOpenFile={onOpenFile} />}
    </>
  );
}

function LanguageRow({ t, open, onOpen, onEnabled, onRemove }: { t: Translation; open: boolean; onOpen: () => void; onEnabled: (on: boolean) => void; onRemove: () => void }) {
  const { config } = useAdmin();
  const { total, decided, count } = translationStatus(config, t);
  const toCheck = count.name + count.edited;
  return (
    <li className={`adm-lang${open ? " is-open" : ""}`}>
      <button type="button" className="adm-lang-main" aria-pressed={open} onClick={onOpen}>
        <span className="adm-lang-name">
          {fullName(t.code)}{" "}
          {count.missing > 0 && <span className="adm-tag is-draft">⚠ {count.missing} missing</span>}
        </span>
        <span className="adm-hint">
          {decided} of {total} texts{toCheck > 0 && `, ${toCheck} to check`}
          {!t.enabled && ", hidden from visitors"}
        </span>
        <span className="adm-lang-bar" aria-hidden>
          <span style={{ width: `${total ? (decided / total) * 100 : 0}%` }} />
        </span>
      </button>
      <input type="checkbox" className="adm-switch" aria-label={`Show ${inEnglish(t.code)} to visitors`} title="Show to visitors" checked={t.enabled} onChange={(e) => onEnabled(e.target.checked)} />
      <button type="button" className="adm-icon-btn" aria-label={`Remove ${inEnglish(t.code)}`} onClick={onRemove}>
        ×
      </button>
    </li>
  );
}

/** The texts of the site with what was decided for them in one language. */
function Texts({ t, change }: { t: Translation; change: (fn: (t: Translation) => Translation) => void }) {
  const { config } = useAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const { rows, total, decided, count, stale } = translationStatus(config, t);
  const types = useMemo(() => new Map(allSections(config).map((s) => [s.id, s.type as string])), [config]);
  /** "Links · Label" */
  const field = (use: TextUse) => {
    const type = use.sectionId ? types.get(use.sectionId) : undefined;
    return [type && (widgetLabels.get(type) ?? type), use.title].filter(Boolean).join(" · ");
  };
  const byPlace = useMemo(() => new Map(collectTexts(config).map((u) => [u.place, u])), [config]);
  const where = (place: string) => {
    const use = byPlace.get(place);
    return use ? `${placeOf(config, use)}, ${field(use)}` : "a text that is no longer on the site";
  };

  const inFilter = (row: TextRow, f: Filter) => f === "all" || (f === "missing" ? row.state === "missing" : f === "done" ? row.state === "done" : row.state === "name" || row.state === "edited");
  // What a filter listed when it was chosen: a row must not vanish under the first letter typed into it, or when unticked.
  const [listed, setListed] = useState<Set<string> | null>(null);
  const choose = (f: Filter) => {
    setFilter(f);
    setListed(f === "all" ? null : new Set(rows.filter((row) => inFilter(row, f)).map((row) => row.key)));
  };

  const term = search.trim().toLowerCase();
  const shown = rows.filter((row) => (!listed || listed.has(row.key)) && (!term || row.use.text.toLowerCase().includes(term) || row.value.toLowerCase().includes(term)));
  const groups = new Map<string, TextRow[]>();
  for (const row of shown) {
    const place = placeOf(config, row.use);
    groups.set(place, [...(groups.get(place) ?? []), row]);
  }

  /** Decides one text in one place: a translation, "doesn't translate", or (undefined) nothing yet. */
  const decide = ({ use }: TextRow, entry: TextEntry | undefined) => change((x) => withEntry(x, use.place, use.text, entry));
  const names = rows.filter((row) => row.state === "name");

  return (
    <section className="adm-block">
      <div className="adm-panel-head">
        <h2>{inEnglish(t.code)} texts</h2>
        <span className="adm-tag">
          {decided} of {total}
        </span>
      </div>
      <div className="adm-pad adm-form">
        <div className="adm-seg" role="group" aria-label="Texts to show">
          <button type="button" aria-pressed={filter === "all"} onClick={() => choose("all")}>
            All
          </button>
          <button type="button" aria-pressed={filter === "missing"} onClick={() => choose("missing")}>
            Missing {count.missing}
          </button>
          <button type="button" aria-pressed={filter === "check"} onClick={() => choose("check")}>
            To check {count.name + count.edited}
          </button>
          <button type="button" aria-pressed={filter === "done"} onClick={() => choose("done")}>
            Done {count.done}
          </button>
        </div>
        <input className="adm-input" type="search" aria-label="Search texts" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="adm-hint">
          A text without a translation is shown in the original. The same text in two places is translated in each, because it may mean something else there; what you chose elsewhere is offered. Tick “Doesn&apos;t
          translate” for names and other texts that stay as they are.
        </p>

        {filter === "check" && names.length > 1 && (
          <button type="button" className="adm-btn is-small" onClick={() => change((x) => names.reduce((acc, { use }) => withEntry(acc, use.place, use.text, { same: true }), x))}>
            None of these {names.length} names translate
          </button>
        )}

        {[...groups].map(([place, list]) => (
          <div key={place} className="adm-tr-group">
            <h3>{place}</h3>
            {list.map((row) => {
              const { use, value, same, state } = row;
              const long = use.long || use.text.length > 60 || use.text.includes("\n");
              const open = state === "missing" || state === "name";
              const input = {
                className: "adm-input",
                lang: t.code,
                dir: "auto",
                "aria-label": `${inEnglish(t.code)} for: ${use.text.slice(0, 80)}`,
                value,
                placeholder: same ? use.text.split("\n")[0] : undefined,
                onChange: (e: { target: { value: string } }) => decide(row, e.target.value ? { to: e.target.value } : undefined),
              };
              return (
                <div key={row.key} className="adm-tr">
                  <span className="adm-hint adm-tr-head">
                    <span>{field(use)}</span>
                    {state === "missing" && <span className="adm-tag is-draft">⚠ Not translated</span>}
                    {state === "name" && <span className="adm-tag">Name?</span>}
                    {same && <span className="adm-tag is-live">✓ Doesn&apos;t translate</span>}
                  </span>
                  <span className="adm-tr-text" dir="auto">
                    {use.text}
                  </span>
                  {long ? <textarea rows={Math.min(8, Math.max(2, Math.ceil(use.text.length / 38)))} {...input} /> : <input {...input} />}
                  {open &&
                    suggestTranslations(t, use.place, use.text).map((s) => (
                      <div key={s.text ?? ""} className="adm-tr-suggest">
                        <span>
                          {s.text === null ? "Doesn't translate" : <strong lang={t.code}>{s.text}</strong>}
                          <span className="adm-hint">
                            {s.from === use.text ? "in " : `like “${s.from}” in `}
                            {where(s.place)}
                          </span>
                        </span>
                        <button type="button" className="adm-btn is-small" onClick={() => decide(row, s.text === null ? { same: true } : { to: s.text })}>
                          Same here
                        </button>
                      </div>
                    ))}
                  {!value.trim() && (
                    <label className="adm-tr-keep">
                      <input type="checkbox" checked={same} onChange={(e) => decide(row, e.target.checked ? { same: true } : undefined)} />
                      Doesn&apos;t translate
                    </label>
                  )}
                  {state === "edited" && (
                    <span className="adm-tr-check">
                      The original was edited after this was {same ? "confirmed" : "translated"}.{" "}
                      <button type="button" className="adm-link" onClick={() => decide(row, same ? { same: true } : { to: value })}>
                        It is still right
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {!shown.length && <p className="adm-hint">{term ? "No text matches." : filter === "missing" ? "Everything is translated." : filter === "done" ? "Nothing is translated yet." : "Nothing to check."}</p>}

        {stale.length > 0 && (
          <details className="adm-tr-stale">
            <summary>
              {stale.length} translation{stale.length === 1 ? "" : "s"} of texts that are no longer on the site
            </summary>
            <ul>
              {stale.map((s) => (
                <li key={`${s.place} ${s.text}`}>
                  {s.text.slice(0, 80)} → {s.to ? s.to.slice(0, 80) : "doesn't translate"}
                </li>
              ))}
            </ul>
            <button type="button" className="adm-btn is-small" onClick={() => change((x) => stale.reduce((acc, s) => withEntry(acc, s.place, s.text, undefined), x))}>
              Remove them
            </button>
          </details>
        )}
      </div>
    </section>
  );
}

/** Markdown files (Markdown widgets and blog posts): which have a version in this language. */
function Files({ code, onOpenFile }: { code: string; onOpenFile: (target: ContentTarget) => void }) {
  const { config, published } = useAdmin();
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ files: { name: string }[] }>("content")
      .then((d) => setFiles(d.files.map((f) => f.name)))
      .catch((err) => setError((err as Error).message));
  }, []);
  useEffect(load, [load]);
  if (!files) return error ? <p className="adm-notice is-bad">{error}</p> : null;

  const names = new Set(files);
  const languages = contentLanguages(config.languages, published.languages.original);
  const originals = [...new Set(files.map((f) => contentPlace(f, languages, names).name))];
  return (
    <section className="adm-block">
      <div className="adm-panel-head">
        <h2>{inEnglish(code)} markdown files</h2>
      </div>
      <div className="adm-pad adm-form">
        <p className="adm-hint">
          For Markdown widgets and blog posts. They are translated on the Content screen, under the same language. A file without a translation is shown in the original. Unlike the texts above, files are live as soon as they are
          saved.
        </p>
        {error && <p className="adm-notice is-bad">{error}</p>}
        <ul className="adm-tr-files">
          {originals.map((name) => {
            const done = names.has(`${code}/${name}`);
            return (
              <li key={name}>
                <span>{name}</span>
                {!done && <span className="adm-tag is-draft">⚠ Not translated</span>}
                <button type="button" className="adm-link" onClick={() => onOpenFile({ name, lang: code })}>
                  {done ? "Edit" : "Translate"}
                </button>
              </li>
            );
          })}
        </ul>
        {!originals.length && <p className="adm-hint">No markdown files yet.</p>}
      </div>
    </section>
  );
}
