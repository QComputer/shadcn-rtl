import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";
import { resolveOrganizationBranding } from "@/lib/organization-branding";

describe("operational app manifest", () => {
  it("keeps the platform fallback inside each build topology", () => {
    const root = buildOperationalAppManifest({ basePath: "" });
    const path = buildOperationalAppManifest({ basePath: "/app" });
    assert.equal(root.name, "Bazarbaaz | بازارباز");
    assert.equal(root.start_url, "/fa");
    assert.equal(root.scope, "/");
    assert.equal(path.start_url, "/app/fa");
    assert.equal(path.scope, "/app/");
    assert.ok(path.icons?.every((icon) => String(icon.src).startsWith("/app/")));
    assert.ok(path.shortcuts?.every((shortcut) => shortcut.url.startsWith("/app/")));
  });

  it("uses generic organization branding without weakening maskable fallbacks", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-fixture",
      name: "Fixture Organization",
      logo: null,
      coverImage: null,
      branding: {
        organizationId: "org-fixture",
        displayName: "Fixture Brand",
        shortName: "Fixture",
        pwaIcon192Url: "https://assets.example/192.png",
        pwaIcon512Url: "/tenant-assets/512.png",
        source: "BAZARBAAZ_MANAGED",
      },
    });
    const manifest = buildOperationalAppManifest({ basePath: "/app", branding });
    assert.equal(manifest.name, "Fixture Brand");
    assert.equal(manifest.short_name, "Fixture");
    assert.equal(manifest.icons?.[0]?.src, "https://assets.example/192.png");
    assert.equal(manifest.icons?.[1]?.src, "/app/tenant-assets/512.png");
    assert.equal(manifest.icons?.[2]?.src, "/app/icons/icon-maskable-192x192.png");
  });

  it("rejects unsafe tenant icon schemes and uses application-owned assets", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-fixture",
      name: "Fixture",
      logo: null,
      coverImage: null,
      branding: {
        organizationId: "org-fixture",
        pwaIcon192Url: "javascript:alert(1)",
        pwaIcon512Url: "//untrusted.example/icon.png",
      },
    });
    const manifest = buildOperationalAppManifest({ basePath: "/app", branding });
    assert.equal(manifest.icons?.[0]?.src, "/app/icons/icon-192x192.png");
    assert.equal(manifest.icons?.[1]?.src, "/app/icons/icon-512x512.png");
  });
});
