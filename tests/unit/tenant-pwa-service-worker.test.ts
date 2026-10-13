import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync("public/web-push-sw.js", "utf8");

describe("tenant-branded PWA service worker", () => {
  it("does not cache manifests or tenant favicon identity", () => {
    assert.match(source, /version: "p99-tenant-branded-pwa"/);
    assert.match(source, /manifestUrl: withBasePath\("\/manifest\.webmanifest"\)/);
    assert.doesNotMatch(source, /"\/manifest\.webmanifest",/);
    assert.doesNotMatch(source, /withoutBasePath\(url\.pathname\) === "\/favicon\.ico"/);
    assert.doesNotMatch(source, /staticAssets:[\s\S]*?\/icons\/icon-/);
  });

  it("uses the current origin manifest for notification identity", () => {
    assert.match(source, /fetch\(PWA_CACHE\.manifestUrl, \{ cache: "no-store" \}\)/);
    assert.match(source, /manifest\?\.short_name \|\| manifest\?\.name/);
    assert.match(source, /\.\.\.\(iconUrl \? \{ icon: iconUrl \} : \{\}\)/);
    assert.doesNotMatch(source, /icon: withBasePath\("\/icons\/icon-192x192\.png"\)/);
  });
});
