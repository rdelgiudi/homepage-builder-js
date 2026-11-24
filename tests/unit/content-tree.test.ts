import { test } from "node:test";
import assert from "node:assert/strict";
import { contentTree, dropTarget, foldersBehind, joinPath, languageView, parentOf } from "@/components/admin/content-tree";

const f = (name: string) => ({ name, bytes: 1, modifiedAt: 0 });

test("contentTree nests files under their folders, folders first, with counts", () => {
  const root = contentTree([f("b.md"), f("blog/2026/hello.md"), f("blog/intro.md"), f("a.md")], ["blog", "empty", "blog/2026"]);
  assert.deepEqual(root.files.map((x) => x.name), ["a.md", "b.md"]);
  assert.deepEqual(root.folders.map((x) => x.path), ["blog", "empty"]);
  const blog = root.folders[0];
  assert.equal(blog.count, 2);
  assert.deepEqual(blog.folders.map((x) => x.label), ["2026"]);
  assert.deepEqual(blog.files.map((x) => x.name), ["blog/intro.md"]);
  assert.equal(root.folders[1].count, 0);
  assert.equal(root.count, 4);
});

test("contentTree adds folders that only appear in file paths", () => {
  const root = contentTree([f("x/y/z.md")], []);
  assert.equal(root.folders[0].folders[0].files[0].name, "x/y/z.md");
});

test("paths and drop targets", () => {
  assert.equal(parentOf("blog/2026/hello.md"), "blog/2026");
  assert.equal(parentOf("a.md"), "");
  assert.equal(joinPath("", "a.md"), "a.md");
  assert.equal(dropTarget("blog/hello.md", ""), "hello.md");
  assert.equal(dropTarget("hello.md", "blog"), "blog/hello.md");
  assert.equal(dropTarget("hello.md", ""), null); // already there
  assert.equal(dropTarget("blog", "archive"), "archive/blog");
  assert.equal(dropTarget("blog", "blog/2026"), null); // into itself
  assert.equal(dropTarget("blog", "blog"), null);
});

test("languageView: one tree for every language, without the language folders", () => {
  const two = { original: "en", codes: ["it", "fr"] };
  const files = [f("en/about.md"), f("en/blog/hi.md"), f("loose.md"), f("it/about.md"), f("it/extra.md")];
  const folders = ["en", "en/blog", "en/empty", "it", "fr", "plain"];
  const rows = (lang: string) => languageView(files, folders, two, lang).files.map((x) => [x.name, x.path, x.state, x.saveTo]);
  assert.deepEqual(rows("en"), [
    ["about.md", "en/about.md", "own", "en/about.md"],
    ["blog/hi.md", "en/blog/hi.md", "own", "en/blog/hi.md"],
    ["extra.md", "it/extra.md", "missing", "en/extra.md"], // only in Italian: shown in it
    ["loose.md", "loose.md", "own", "loose.md"],
  ]);
  assert.deepEqual(rows("it"), [
    ["about.md", "it/about.md", "own", "it/about.md"],
    ["blog/hi.md", "en/blog/hi.md", "missing", "it/blog/hi.md"],
    ["extra.md", "it/extra.md", "own", "it/extra.md"],
    ["loose.md", "loose.md", "missing", "it/loose.md"],
  ]);
  const en = languageView(files, folders, two, "en");
  assert.deepEqual([en.folders, en.codes, en.base], [["blog", "empty", "plain"], ["en", "it", "fr"], "en/"]);
  assert.deepEqual(languageView(files, folders, two, "it").folders, en.folders, "the same tree");
});

test("languageView: while the draft changes the main language, the files are where they were", () => {
  const files = [f("en/a.md"), f("it/a.md"), f("b.md")];
  const v = languageView(files, ["en", "it"], { original: "de", codes: ["it"], previous: "en" }, "de");
  assert.deepEqual(v.files.map((x) => [x.name, x.path, x.state, x.saveTo]), [["a.md", "en/a.md", "own", "en/a.md"], ["b.md", "b.md", "own", "b.md"]]);
  assert.deepEqual([v.codes, v.folders, v.base], [["de", "it"], [], "en/"]);
});

test("languageView: main language swapped with a translation", () => {
  const files = [f("en/a.md"), f("en/b.md"), f("it/a.md")];
  const v = languageView(files, ["en", "it"], { original: "it", codes: ["en"] }, "it");
  assert.deepEqual(v.files.map((x) => [x.name, x.path, x.state, x.shownIn, x.saveTo]), [
    ["a.md", "it/a.md", "own", "it", "it/a.md"],
    ["b.md", "en/b.md", "missing", "en", "it/b.md"],
  ]);
});

test("languageView: a site in one language is as it was; leftovers of a removed language stay reachable", () => {
  const one = { original: "en", codes: [] };
  const plain = languageView([f("a.md"), f("it/printer.md")], ["it"], one, "en");
  assert.deepEqual(plain.files.map((x) => x.name), ["a.md", "it/printer.md"], "a folder that is just called it");
  assert.deepEqual([plain.folders, plain.codes, plain.base], [["it"], ["en"], ""]);
  const left = languageView([f("en/a.md"), f("it/a.md")], ["en", "it"], one, "en");
  assert.deepEqual([left.files.map((x) => x.name), left.folders, left.codes, left.base], [["a.md"], [], ["en", "it"], "en/"]);
});

test("languageView: an original hidden behind another of the same name is reported", () => {
  const v = languageView([f("a.md"), f("en/a.md")], ["en"], { original: "en", codes: ["it"] }, "en");
  assert.deepEqual(v.files.map((x) => x.path), ["en/a.md"]);
  assert.deepEqual(v.shadowed, ["a.md"]);
  assert.deepEqual(foldersBehind("blog", ["blog", "en/blog", "it/blog", "x"], { original: "en", codes: ["it"] }, ["en", "it"]), ["blog", "en/blog", "it/blog"]);
});
