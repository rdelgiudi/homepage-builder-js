import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { migrateConfig } from "@/lib/schema/migrate";
import { parseConfig, strictParseConfig } from "@/lib/schema/parse";
import { SectionSchema, widgetMetas } from "@/widgets/meta";

type Obj = Record<string, unknown>;
const v1 = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../fixtures/homepage.v1.json"), "utf-8")) as Obj;
const v1Tabs = v1.tabs as { label: string; sections: Obj[] }[];

describe("v1 → v2 migration", () => {
  const result = parseConfig(structuredClone(v1));
  const config = result.config!;

  it("loads the original v1 example without errors or dropped sections", () => {
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(config.version, 2);
    assert.deepEqual(
      config.tabs.map((t) => t.sections.length),
      v1Tabs.map((t) => t.sections.length)
    );
  });

  it("keeps every section option exactly", () => {
    v1Tabs.forEach((tab, ti) =>
      tab.sections.forEach((section, si) => {
        for (const [key, value] of Object.entries(section)) {
          assert.deepEqual((config.tabs[ti].sections[si] as Obj)[key], value, `${tab.label} → ${section.type}.${key}`);
        }
      })
    );
  });

  it("moves backgroundColor and the particle settings into background", () => {
    assert.equal(config.background.base.light, "#f3f4f6");
    assert.equal(config.background.base.dark, "#111827");
    assert.equal(config.background.effect.type, "comet");
    assert.ok(!("particleBackground" in config.effects));
    assert.ok(!("backgroundColor" in (config as Obj)));
  });

  it("turns particleBackground: false into no effect", () => {
    const off = parseConfig({ effects: { particleBackground: false, particleEffect: "comet" } }).config!;
    assert.equal(off.background.effect.type, "none");
  });

  it("gives every tab and section a unique, repeatable id", () => {
    const ids = config.tabs.flatMap((t) => [t.id, ...t.sections.map((s) => s.id)]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(config.tabs.map((t) => t.id), ["welcome", "social", "gaming", "projects", "widgets", "guestbook"]);
    assert.deepEqual(config.tabs[0].sections.slice(0, 3).map((s) => s.id), ["welcome-header", "welcome-text", "welcome-text-2"]);
    const again = parseConfig(structuredClone(v1)).config!;
    assert.deepEqual(again.tabs.flatMap((t) => t.sections.map((s) => s.id)), config.tabs.flatMap((t) => t.sections.map((s) => s.id)));
  });

  it("never gives a generated id that collides with one written by hand", () => {
    const migrated = migrateConfig({
      tabs: [
        { label: "A", sections: [{ type: "text", content: "x" }] },
        { id: "a", label: "B", sections: [{ id: "a-text", type: "text", content: "y" }] },
      ],
    });
    const tabs = migrated.tabs as { id: string; sections: { id: string }[] }[];
    assert.deepEqual(tabs.map((t) => t.id), ["a-2", "a"]);
    assert.equal(tabs[0].sections[0].id, "a-2-text");
    assert.equal(tabs[1].sections[0].id, "a-text");
  });

  it("de-duplicates tabs with the same label", () => {
    const config = parseConfig({ tabs: [{ label: "Same", sections: [] }, { label: "Same", sections: [] }] }).config!;
    assert.deepEqual(config.tabs.map((t) => t.id), ["same", "same-2"]);
  });

  it("is stable: parsing a v2 result again changes nothing", () => {
    assert.deepEqual(parseConfig(structuredClone(config)).config, config);
  });
});

describe("lenient parsing (what the public site uses)", () => {
  it("fills every default from an empty file", () => {
    const { config, errors } = parseConfig({});
    assert.deepEqual(errors, []);
    assert.equal(config!.name, "Homepage");
    assert.equal(config!.layout.site, "tabs");
    assert.equal(config!.background.effect.type, "stars");
    assert.equal(config!.effects.gradientBorders, true);
    assert.deepEqual(config!.tabs, []);
  });

  it("drops a broken section or tab, keeps the rest, and says why", () => {
    const { config, warnings } = parseConfig({
      tabs: [
        { label: "A", sections: [{ type: "header" }, { type: "no-such-widget" }, { type: "text", content: "kept" }] },
        { sections: [] },
        "not a tab",
      ],
    });
    assert.equal(config!.tabs.length, 1);
    assert.deepEqual(config!.tabs[0].sections.map((s) => s.type), ["text"]);
    assert.equal(warnings.length, 4);
    assert.match(warnings[0], /sections\[0\].*header.*title/);
    assert.match(warnings[1], /no-such-widget/);
  });

  it("refuses a config whose top level is wrong", () => {
    assert.equal(parseConfig({ name: 5 }).config, null);
    assert.match(parseConfig({ version: 3 }).errors[0], /version/);
  });
});

describe("strict parsing (what the admin panel saves)", () => {
  const valid = parseConfig(structuredClone(v1)).config!;

  it("accepts a valid config", () => {
    assert.ok(strictParseConfig(structuredClone(valid)).config);
  });

  it("reports a broken section instead of dropping it", () => {
    const broken = structuredClone(valid) as unknown as { tabs: { sections: Obj[] }[] };
    delete broken.tabs[0].sections[0].title;
    const { config, issues } = strictParseConfig(broken);
    assert.equal(config, null);
    assert.equal(issues[0].path, "tabs.0.sections.0.title");
  });

  it("rejects a missing or empty body instead of saving an empty, all-defaults site", () => {
    for (const raw of [undefined, null, "x", [], {}, { name: "Only a name" }]) {
      const { config, issues } = strictParseConfig(raw);
      assert.equal(config, null, JSON.stringify(raw));
      assert.ok(issues.length);
    }
    // An explicitly empty site is still allowed.
    assert.ok(strictParseConfig({ version: 2, tabs: [] }).config);
  });

  it("rejects duplicate ids", () => {
    const dup = structuredClone(valid);
    dup.tabs[1].sections[0].id = dup.tabs[0].sections[0].id;
    const { config, issues } = strictParseConfig(dup);
    assert.equal(config, null);
    assert.match(issues[0].message, /Duplicate id/);
  });
});

describe("widget registry", () => {
  it("lists exactly the section types the schema accepts", () => {
    const schemaTypes = SectionSchema.options.map((o) => o.shape.type.value).sort();
    assert.deepEqual(widgetMetas.map((m) => m.type).sort(), schemaTypes);
  });

  it("gives every widget defaults that are a valid section", () => {
    for (const meta of widgetMetas) {
      const result = meta.schema.safeParse({ ...meta.defaults, id: "x", type: meta.type });
      assert.ok(result.success, `${meta.type}: ${result.success ? "" : result.error.message}`);
    }
  });

  it("puts every widget in a palette category", () => {
    const categories = new Set(["content", "media", "info", "social", "gaming", "community"]);
    for (const meta of widgetMetas) assert.ok(categories.has(meta.category), `${meta.type}: ${meta.category}`);
  });
});

describe("showcase config (src/config/homepage.showcase.json)", () => {
  const showcase = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../src/config/homepage.showcase.json"), "utf-8"));

  it("passes the strict check the admin panel uses for publishing", () => {
    const res = strictParseConfig(showcase);
    assert.deepEqual(res.issues, []);
    assert.deepEqual(parseConfig(showcase).warnings, []);
  });

  it("shows every widget type, so a new widget gets added to it", () => {
    const used = new Set(showcase.tabs.flatMap((t: { sections: { type: string }[] }) => t.sections.map((s) => s.type)));
    const missing = widgetMetas.map((m) => m.type).filter((t) => !used.has(t));
    assert.deepEqual(missing, []);
  });

  it("its markdown files exist", () => {
    const files = showcase.tabs.flatMap((t: { sections: { type: string; file?: string }[] }) => t.sections.filter((s) => s.type === "markdown").map((s) => s.file));
    for (const f of files) assert.ok(fs.existsSync(path.join(import.meta.dirname, "../../src/content", f)), f);
  });
});
