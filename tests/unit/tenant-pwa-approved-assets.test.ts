import assert from "node:assert/strict";
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
