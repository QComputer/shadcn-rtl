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
    for (const pathname of ["/fa/contact", "/en/contact", "/ar/contact"]) {
      assert.equal((await fetch(`${base}${pathname}`)).status, 200);
    }
    assert.equal((await fetch(`${base}/server.mjs`)).status, 404, "server source remains private");
  } finally {
    if (child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  }
});
