import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, it } from "node:test";

const bootstrap = await readFile(new URL("../../public/theme-prepaint.js", import.meta.url), "utf8");

function runThemeBootstrap(saved, prefersDark, storageThrows = false) {
  const classes = new Set(["dark"]);
  const attributes = new Map();
  const sandbox = {
    document: { documentElement: {
      classList: {
        remove: (...names) => names.forEach(name => classes.delete(name)),
        add: name => classes.add(name),
      },
      setAttribute: (name, value) => attributes.set(name, value),
    } },
    window: {
      localStorage: { getItem: () => { if (storageThrows) throw new Error("blocked"); return saved; } },
      matchMedia: () => ({ matches: prefersDark }),
    },
  };
  runInNewContext(bootstrap, sandbox);
  return { classes: [...classes], theme: attributes.get("data-theme") };
}

describe("CSP-compatible theme prepaint bootstrap", () => {
  it("resolves every stored theme before application hydration", () => {
    assert.deepEqual(runThemeBootstrap("light", true), { classes: ["light"], theme: "light" });
    assert.deepEqual(runThemeBootstrap("dark", false), { classes: ["dark"], theme: "dark" });
    assert.deepEqual(runThemeBootstrap("warm-cream", true), { classes: ["light"], theme: "warm-cream" });
    assert.deepEqual(runThemeBootstrap("charcoal-gray", false), { classes: ["dark"], theme: "charcoal-gray" });
    assert.deepEqual(runThemeBootstrap("system", true), { classes: ["dark"], theme: "system" });
    assert.deepEqual(runThemeBootstrap("system", false), { classes: ["light"], theme: "system" });
  });

  it("fails safely when localStorage is unavailable or contains an invalid value", () => {
    assert.deepEqual(runThemeBootstrap("unknown", false), { classes: ["dark"], theme: "dark" });
    assert.deepEqual(runThemeBootstrap(null, false, true), { classes: ["dark"], theme: "dark" });
  });

  it("loads as a same-origin parser-blocking classic script without weakening Damoon CSP", async () => {
    const [layout, proxy] = await Promise.all([
      readFile(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../proxy.ts", import.meta.url), "utf8"),
    ]);
    assert.match(layout, /<script src=\{appResourceUrl\("\/theme-prepaint\.js", appBasePath\)\} \/>/);
    assert.doesNotMatch(layout, /dangerouslySetInnerHTML/);
    assert.match(proxy, /script-src 'self'/);
  });
});
