import { test } from "node:test";
import assert from "node:assert/strict";
import { contentTree, dropTarget, joinPath, parentOf } from "@/components/admin/content-tree";

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
