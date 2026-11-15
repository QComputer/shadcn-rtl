import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const source = await readFile(new URL("app/[locale]/retail/[organization]/retail-catalog.tsx", root), "utf8");
const shop = await readFile(new URL("app/[locale]/[slug]/shop/shop-content.tsx", root), "utf8");
const page = await readFile(new URL("app/[locale]/retail/[organization]/page.tsx", root), "utf8");

test("server snapshot pagination is passed to both homepage entry points", () => {
  assert.match(shop, /products: catalog\.products,\s*pagination: catalog\.pagination/);
  assert.match(page, /products: catalog\.products,\s*pagination: catalog\.pagination/);
});

test("hydration reuses server page and subsequent requests retain its page size", () => {
  assert.match(source, /useState\(view\.pagination\)/);
  assert.match(source, /useState\(view\.pagination\.page\)/);
  assert.match(source, /if \(!requestEnabled\) return/);
  assert.match(source, /limit: String\(view\.pagination\.limit\)/);
  assert.doesNotMatch(source, /limit: "50"/);
});

test("tenant keyed instance and in-flight cancellation protect displayed data", () => {
  assert.match(source, /key=\{props\.view\.identifier\}/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /busy \|\| pagination\.page/);
});

test("refresh keeps product grid visible while request is pending", () => {
  assert.match(source, /busy && <p role="status"/);
  assert.match(source, /products\.map\(renderProduct\)/);
});
