import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { test } from "node:test";

test("Damoon standalone server serves its complete browser module graph", { timeout: 20000 }, async () => {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ["sites/damoon/server.mjs"], {
    env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => { throw new Error("Owned Damoon server exited before readiness."); }),
    ]);
    const base = `http://127.0.0.1:${port}`;
    const pending = ["/app.js"], visited = new Set();
    while (pending.length) {
      const pathname = pending.pop();
      if (visited.has(pathname)) continue;
      visited.add(pathname);
      const response = await fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200, `${pathname} must be available to the browser`);
      assert.match(response.headers.get("content-type"), /javascript/);
      const source = await response.text();
      for (const match of source.matchAll(/\bfrom\s*["'](\.\/[^"']+\.js)["']/g)) {
        pending.push(new URL(match[1], `${base}${pathname}`).pathname);
      }
    }
    assert.ok(visited.has("/booking-flow.js"), "booking flow is a transitive app dependency");
    assert.ok(visited.has("/virtual-tour.js"), "virtual tour origin validation is part of the served app module graph");
    assert.ok(visited.has("/damoon-attractions-data.js"), "the reviewed attractions dataset is public to the frontend");
    assert.ok(visited.has("/damoon-attractions-view.js"), "the attractions listing renderer is served");
    assert.ok(visited.has("/damoon-attractions-detail-view.js"), "the attractions detail renderer is served");
    assert.ok(visited.has("/damoon-leaflet-maps.js"), "the lazy map adapter is part of the local browser module graph");
    const mapResponse = await fetch(`${base}/attractions`);
    const csp = mapResponse.headers.get("content-security-policy");
    assert.match(csp, /img-src 'self' data: https:\/\/tile\.openstreetmap\.org/);
    assert.doesNotMatch(csp, /img-src[^;]*\*/);
    assert.match(mapResponse.headers.get("referrer-policy"), /^strict-origin-when-cross-origin$/);
    for (const asset of ["leaflet.js", "leaflet.css", "images/marker-icon.png", "images/marker-icon-2x.png", "images/marker-shadow.png", "images/layers.png", "images/layers-2x.png"]) {
      const response = await fetch(`${base}/damoon-front/vendor/leaflet/${asset}`);
      if (process.env.CI === "true") assert.equal(response.status, 200, `${asset} is served from the locked local Leaflet package`);
      else assert.ok([200, 404].includes(response.status), `${asset} is an explicit static allowlist route`);
    }
    for (const pathname of ["/fa/contact", "/en/contact", "/ar/contact"]) {
      assert.equal((await fetch(`${base}${pathname}`)).status, 200);
    }
    const slugs = ["museum-archaeology", "grand-mosque", "atabakan-mosque", "do-khatun-shrine", "mellat-park", "chaleshtar-castle", "gerdab-ben", "zaman-khan-bridge"];
    for (const locale of ["", "/fa", "/en", "/ar"]) {
      assert.equal((await fetch(`${base}${locale}/attractions`)).status, 200, `${locale || "default"} attractions list`);
      for (const slug of slugs) assert.equal((await fetch(`${base}${locale}/attractions/${slug}`)).status, 200, `${locale || "default"} ${slug}`);
    }
    assert.equal((await fetch(`${base}/attractions/unknown-slug`)).status, 404, "unknown attraction slugs remain 404");
    assert.equal((await fetch(`${base}/server.mjs`)).status, 404, "server source remains private");
  } finally {
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  }
});
