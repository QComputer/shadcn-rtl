import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function pngSize(path: string) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path} is PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assertIco(path: string) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt16LE(0), 0, `${path} reserved field`);
  assert.equal(bytes.readUInt16LE(2), 1, `${path} ICO type`);
  assert.ok(bytes.readUInt16LE(4) > 0, `${path} contains icon images`);
}

describe("approved tenant PWA assets", () => {
  it("matches the corrected Bazarbaaz October 13 icon package", () => {
    const expected = new Map([
      ["public/icons/icon-192x192.png", "76e4ecb1c3a2da04dc8f2cf47bd6e31f72b8fd5db8575e74223ce54477e9260f"],
      ["public/icons/icon-512x512.png", "1acacf7030fb211dd57759925eb9d3579803f7ecbc4dbc2c303c31ff5af026ef"],
      ["public/icons/icon-maskable-192x192.png", "94700bfed2e8d09c5a019550ec4ed82a50ae1a2bff59bf21d93caa62ca31846e"],
      ["public/icons/icon-maskable-512x512.png", "34b336b1785db46abfed415617d27be205a2524c7f9dc6a83a50f713d7267746"],
      ["public/icons/apple-touch-icon.png", "241642370c3ed2b01c71f41c0d1a8aeeCD15f68d432317d3a4246a7e9d123d6e".toLowerCase()],
    ]);
    for (const [path, hash] of expected) {
      const bytes = readFileSync(path);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, `${path} matches the owner-provided corrected package`);
    }
    assert.deepEqual(pngSize("public/icons/icon-192x192.png"), { width: 192, height: 192 });
    assert.deepEqual(pngSize("public/icons/icon-512x512.png"), { width: 512, height: 512 });
    assert.deepEqual(pngSize("public/icons/icon-maskable-192x192.png"), { width: 192, height: 192 });
    assert.deepEqual(pngSize("public/icons/icon-maskable-512x512.png"), { width: 512, height: 512 });
    assert.deepEqual(pngSize("public/icons/apple-touch-icon.png"), { width: 180, height: 180 });
  });

  it("has Aka Shoes regular, maskable and Apple icons at expected dimensions", () => {
    const base = "public/brand/tenants/aka-shoes";
    assert.deepEqual(pngSize(`${base}/pwa/icon-192x192.png`), { width: 192, height: 192 });
    assert.deepEqual(pngSize(`${base}/pwa/icon-512x512.png`), { width: 512, height: 512 });
    assert.deepEqual(pngSize(`${base}/pwa/maskable-192x192.png`), { width: 192, height: 192 });
    assert.deepEqual(pngSize(`${base}/pwa/maskable-512x512.png`), { width: 512, height: 512 });
    assert.deepEqual(pngSize(`${base}/pwa/apple-touch-icon-180.png`), { width: 180, height: 180 });
    assertIco(`${base}/browser/favicon.ico`);
  });

  it("has Restaurant 13 regular, maskable, Apple and favicon assets", () => {
    const base = "public/brand/tenants/restaurant-13/brand/production-ready";
    assert.deepEqual(pngSize(`${base}/icon-192.png`), { width: 192, height: 192 });
    assert.deepEqual(pngSize(`${base}/icon-512.png`), { width: 512, height: 512 });
    assert.deepEqual(pngSize(`${base}/icon-maskable-192.png`), { width: 192, height: 192 });
    assert.deepEqual(pngSize(`${base}/icon-maskable-512.png`), { width: 512, height: 512 });
    assert.deepEqual(pngSize(`${base}/apple-touch-icon.png`), { width: 180, height: 180 });
    assertIco(`${base}/favicon.ico`);
  });
});
