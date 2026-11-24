"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { BannerConfig, BannerOptions, HomepageConfig, LayoutConfig, PageSettingGroup, PageSettings } from "@/lib/schema/config";
import { HOME, groupValue, pagePath, pageSettings, pageView, sitePages, withPageSetting, withSiteGroup } from "@/lib/pages";
import SchemaForm, { TabChoices } from "./SchemaForm";
import { formSchemas, type JsonSchema } from "./schemas";
import { useAdmin } from "./store";
import { api } from "./api";
import { ignoredBannerSettings, withPhoneBanner, type BannerScreens } from "@/lib/banner";
import type { PreviewDevice } from "./PreviewPane";
import { LayoutPicker } from "./LayoutControls";

type Obj = Record<string, unknown>;

/**
 * What the Header & layout / Background / Effects screens change: the whole site (the defaults every page
 * uses), or one page's own settings. The page is the one the builder and the preview show.
 */
export type SettingsScope = { kind: "site" } | { kind: "page"; id: string; title: string; slug: string };

export interface ScreenProps {
  /** The preview's device: the banner form edits that one's settings when phones have their own. */
  device: PreviewDevice;
  onDevice: (device: PreviewDevice) => void;
  scope: SettingsScope;
  /** The page the preview shows (in site scope too: its own settings hide site changes there). */
  shown: { id: string; title: string; slug: string };
  /** Switch what is being edited: the whole site, or a page (which the builder and preview then show). */
  onScope: (scope: "site" | { pageId: string }) => void;
}

function Block({ title, badge, tone, children }: { title: string; badge?: ReactNode; tone?: "page"; children: ReactNode }) {
  return (
    <section className={`adm-block${tone ? " is-page" : ""}`}>
      <div className="adm-panel-head">
        <h2>{title}</h2>
        {badge}
      </div>
      <div className="adm-pad">{children}</div>
    </section>
  );
}

const NAMES: Record<PageSettingGroup, string> = {
  header: "name and tagline",
  titleColors: "title colors",
  banner: "banner",
  layout: "layout",
  counters: "counters",
  background: "background",
  effects: "effects",
};

/** A form over the top-level keys of the config that `schema` lists. */
function RootForm({ schema }: { schema: JsonSchema }) {
  const { config, update } = useAdmin();
  return <SchemaForm schema={schema} value={config as unknown as Obj} onChange={(v) => update(() => v as unknown as HomepageConfig)} />;
}

/** Settings that are the same on every page (the shared header): in page scope they only say so. */
function SiteOnly({ title, scope, onScope, children }: { title: string; scope: SettingsScope; onScope: ScreenProps["onScope"]; children: ReactNode }) {
  if (scope.kind === "site") return <Block title={title}>{children}</Block>;
  return (
    <Block title={title} badge={<span className="adm-tag">Every page</span>}>
      <p className="adm-hint">
        The same on every page.{" "}
        <button type="button" className="adm-link" onClick={() => onScope("site")}>
          Change it for the whole site
        </button>
      </p>
    </Block>
  );
}

/**
 * One group of settings a page can have of its own. Whole site: edits the site's, and names the
 * pages that don't follow it. One page: either says the page uses the site's (with a button to
 * give it its own, starting from a copy) or edits the page's own (with a way back to the site's).
 */
function Group<G extends PageSettingGroup>({
  group,
  title,
  scope,
  shown,
  onScope,
  children,
}: ScreenProps & { group: G; title: string; children: (value: NonNullable<PageSettings[G]>, onChange: (v: NonNullable<PageSettings[G]>) => void, pageId: string) => ReactNode }) {
  const { config, update } = useAdmin();
  const name = NAMES[group];

  if (scope.kind === "site") {
    const owners = sitePages(config).filter((p) => p.settings?.[group]);
    const shownHasOwn = owners.some((p) => p.id === shown.id);
    return (
      <Block title={title} badge={<span className="adm-tag">Whole site</span>}>
        {shownHasOwn && (
          <p className="adm-notice is-warn">
            The preview shows <strong>{shown.title}</strong>, which has its own {name}, so changes here don&apos;t show there.{" "}
            <button type="button" className="adm-link" onClick={() => onScope({ pageId: shown.id })}>
              Edit {shown.title}&apos;s {name}
            </button>
          </p>
        )}
        {children(groupValue(config, group), (v) => update((c) => withSiteGroup(c, group, v)), HOME)}
        {owners.length > 0 && (
          <p className="adm-hint adm-owners">
            {owners.map((p, i) => (
              <span key={p.id || "home"}>
                {i > 0 && (i === owners.length - 1 ? " and " : ", ")}
                <button type="button" className="adm-link" onClick={() => onScope({ pageId: p.id })}>
                  {p.title}
                </button>
              </span>
            ))}{" "}
            {owners.length === 1 ? "has its own" : "have their own"} {name}, so {owners.length === 1 ? "it doesn't" : "they don't"} use these.
          </p>
        )}
      </Block>
    );
  }

  const own = pageSettings(config, scope.id)?.[group];
  if (!own) {
    return (
      <Block title={title} badge={<span className="adm-tag">From the site</span>}>
        <p className="adm-hint">
          <strong>{scope.title}</strong> uses the site&apos;s {name}.
        </p>
        <div className="adm-actions adm-own-actions">
          <button
            type="button"
            className="adm-btn is-small is-primary"
            onClick={() => update((c) => withPageSetting(c, scope.id, group, structuredClone(groupValue(pageView(c, scope.id), group))))}
          >
            Give {scope.title} its own {name}
          </button>
          <button type="button" className="adm-link" onClick={() => onScope("site")}>
            Change the site&apos;s {name} instead
          </button>
        </div>
      </Block>
    );
  }
  return (
    <Block title={title} tone="page" badge={<span className="adm-tag is-page">Only {scope.title}</span>}>
      {children(own as NonNullable<PageSettings[G]>, (v) => update((c) => withPageSetting(c, scope.id, group, v)), scope.id)}
      <div className="adm-actions adm-own-actions">
        <button type="button" className="adm-btn is-small" onClick={() => update((c) => withPageSetting(c, scope.id, group, undefined))}>
          Use the site&apos;s {name} again
        </button>
      </div>
    </Block>
  );
}

/** The scope switch at the top of the Header & layout / Background / Effects screens. */
export function ScopeBar({ scope, shown, onScope }: ScreenProps) {
  const { config } = useAdmin();
  const pages = sitePages(config);
  const page = scope.kind === "page";
  return (
    <div className={`adm-scope${page ? " is-page" : ""}`}>
      <div className="adm-seg" role="group" aria-label="Settings for">
        <button type="button" aria-pressed={!page} onClick={() => onScope("site")}>
          Whole site
        </button>
        <button type="button" aria-pressed={page} onClick={() => onScope({ pageId: shown.id })}>
          One page
        </button>
      </div>
      {page && pages.length > 1 && (
        <select className="adm-input" aria-label="Page" value={scope.id} onChange={(e) => onScope({ pageId: e.target.value })}>
          {pages.map((p) => (
            <option key={p.id || "home"} value={p.id}>
              {p.title} ({pagePath(p.slug)})
            </option>
          ))}
        </select>
      )}
      <p className="adm-scope-note">
        {page ? (
          <>
            Changing <strong>{scope.title}</strong> (<code>{pagePath(scope.slug)}</code>) only, shown in the preview. Settings it doesn&apos;t have of its own come from the site.
          </>
        ) : (
          <>Changing the whole site: every page that doesn&apos;t have its own setting follows these.</>
        )}
      </p>
    </div>
  );
}

/** The banner's settings: one set for every screen, or one for wide screens and one for phones (the preview shows the one being edited). */
function BannerForm({ value, onChange, layout, device, onDevice }: { value: BannerConfig; onChange: (v: BannerConfig) => void; layout: LayoutConfig } & Pick<ScreenProps, "device" | "onDevice">) {
  const { phone, ...wide } = value;
  const screens: BannerScreens = phone ? device : "all";
  const edited: BannerOptions = phone && device === "phone" ? phone : wide;
  const set = (v: BannerOptions) => onChange(screens === "phone" ? { ...wide, phone: v } : { ...v, ...(phone && { phone }) });
  const ignored = ignoredBannerSettings(layout, edited, screens);
  return (
    <>
      <label className="adm-switch-row">
        <span>
          <span className="adm-label">Different on phones</span>
          <span className="adm-hint">Off = the same settings on every screen</span>
        </span>
        <input
          type="checkbox"
          className="adm-switch"
          checked={!!phone}
          onChange={(e) => {
            onChange(withPhoneBanner(value, e.target.checked));
            onDevice(e.target.checked ? "phone" : "desktop");
          }}
        />
      </label>
      {phone && (
        <div className="adm-field">
          <span className="adm-label">Settings for</span>
          <div className="adm-seg" role="group" aria-label="Banner settings for">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => onDevice("desktop")}>
              Wide screens
            </button>
            <button type="button" aria-pressed={device === "phone"} onClick={() => onDevice("phone")}>
              Phones
            </button>
          </div>
        </div>
      )}
      {/* Keyed: the two sets don't share half-typed input. */}
      <SchemaForm key={screens} schema={formSchemas.banner} value={edited as unknown as Obj} hide={["phone", ...ignored.flatMap((i) => i.keys)]} onChange={(v) => set(v as unknown as BannerOptions)} />
      {ignored.map(
        (i) =>
          i.note && (
            <p key={i.note} className="adm-hint">
              {i.note}
            </p>
          )
      )}
    </>
  );
}

/** Header & layout: name, tagline, title colors, banner, favicon, blog post author, layout, counters (the site's or one page's own). */
export function HeaderLayoutScreen(props: ScreenProps) {
  const { config } = useAdmin();
  return (
    <>
      <Group group="header" title="Name and tagline" {...props}>
        {(value, onChange) => <SchemaForm schema={formSchemas.header} value={value as unknown as Obj} onChange={(v) => onChange(v as unknown as typeof value)} />}
      </Group>
      <Group group="titleColors" title="Title colors" {...props}>
        {(value, onChange) => <SchemaForm schema={formSchemas.gradients} value={value as unknown as Obj} onChange={(v) => onChange(v as unknown as typeof value)} />}
      </Group>
      <Group group="banner" title="Banner" {...props}>
        {(value, onChange, pageId) => {
          // The same fields mean less in some layouts: the page's own layout decides (the site's in site scope).
          const { layout } = props.scope.kind === "site" ? config : pageView(config, pageId);
          return <BannerForm value={value} onChange={onChange} layout={layout} device={props.device} onDevice={props.onDevice} />;
        }}
      </Group>
      <SiteOnly title="Favicon" scope={props.scope} onScope={props.onScope}>
        <RootForm schema={formSchemas.favicon} />
      </SiteOnly>
      <SiteOnly title="Blog posts" scope={props.scope} onScope={props.onScope}>
        <RootForm schema={formSchemas.postAuthor} />
      </SiteOnly>
      <Group group="layout" title="Layout" {...props}>
        {(value, onChange, pageId) => (
          // The profile layout's column is one of the tabs of the page being edited.
          <TabChoices.Provider value={pageView(config, pageId).tabs}>
            <LayoutPicker value={value} onChange={onChange} />
            {/* The layout's own options (bento: widgets per row, one page: section headings); `site` is the picker above. */}
            <SchemaForm schema={formSchemas.layout} value={value as unknown as Obj} hide={["site"]} onChange={(v) => onChange(v as unknown as typeof value)} />
          </TabChoices.Provider>
        )}
      </Group>
      <Group group="counters" title="Counters" {...props}>
        {(value, onChange) => <SchemaForm schema={formSchemas.counters} value={value as unknown as Obj} onChange={(v) => onChange(v as unknown as typeof value)} />}
      </Group>
    </>
  );
}

interface Upload {
  name: string;
  url: string;
  kind: "image" | "video";
  bytes: number;
  inUse: boolean;
}

/** Files uploaded for backgrounds, so unused ones can be removed. */
function Uploads() {
  const { savedTick } = useAdmin();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const load = useCallback(() => {
    api<{ uploads: Upload[] }>("upload")
      .then((d) => setUploads(d.uploads))
      .catch(() => {});
  }, []);
  // Refresh whenever the draft was saved: that is when "in use" can change.
  useEffect(load, [load, savedTick]);

  if (!uploads.length) return <p className="adm-hint">Nothing uploaded yet. Choose Image or Video above and use Upload.</p>;
  return (
    <ul className="adm-uploads">
      {uploads.map((u) => (
        <li key={u.name}>
          {u.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.url} alt="" />
          ) : (
            <video src={u.url} muted preload="metadata" />
          )}
          <span className="adm-hint">
            {u.kind === "image" ? "Image" : "Video"}, {u.bytes > 1048576 ? `${(u.bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(u.bytes / 1024))} KB`}
            {u.inUse ? ", in use" : ""}
          </span>
          <button
            type="button"
            className="adm-btn is-small is-danger"
            disabled={u.inUse}
            title={u.inUse ? "Used by the live site or your draft" : undefined}
            onClick={() => api(`upload?name=${u.name}`, { method: "DELETE" }).then(load)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

export function BackgroundScreen(props: ScreenProps) {
  return (
    <>
      <Group group="background" title="Background" {...props}>
        {(value, onChange) => <SchemaForm schema={formSchemas.background} value={value as unknown as Obj} onChange={(v) => onChange(v as unknown as typeof value)} />}
      </Group>
      <Block title="Uploaded files">
        <Uploads />
      </Block>
    </>
  );
}

export function EffectsScreen(props: ScreenProps) {
  return (
    <Group group="effects" title="Effects" {...props}>
      {(value, onChange) => <SchemaForm schema={formSchemas.effects} value={value as unknown as Obj} onChange={(v) => onChange(v as unknown as typeof value)} />}
    </Group>
  );
}
