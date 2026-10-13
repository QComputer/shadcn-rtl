import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";
import { resolveTenantPwaBranding } from "@/lib/organization-branding";

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

  it("uses only the tenant's persisted regular and maskable icons", () => {
    const branding = resolveTenantPwaBranding({
      organizationId: "org-fixture",
      name: "Fixture Organization",
      logo: null,
      branding: {
        organizationId: "org-fixture",
        displayName: "Fixture Brand",
        shortName: "Fixture",
        pwaIcon192Url: "https://assets.example/192.png",
        pwaIcon512Url: "/tenant-assets/512.png",
        pwaMaskable192Url: "/tenant-assets/maskable-192.png",
        pwaMaskable512Url: "/tenant-assets/maskable-512.png",
      },
    });
    const manifest = buildOperationalAppManifest({ basePath: "/app", tenantBranding: branding });
    assert.equal(manifest.name, "Fixture Brand");
    assert.equal(manifest.short_name, "Fixture");
    assert.equal(manifest.icons?.[0]?.src, "https://assets.example/192.png");
    assert.equal(manifest.icons?.[1]?.src, "/app/tenant-assets/512.png");
    assert.equal(manifest.icons?.[2]?.src, "/app/tenant-assets/maskable-192.png");
    assert.equal(manifest.icons?.[3]?.src, "/app/tenant-assets/maskable-512.png");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.id, "/app/fa");
  });

  it("rejects unsafe tenant icon schemes without substituting platform assets", () => {
    const branding = resolveTenantPwaBranding({
      organizationId: "org-fixture",
      name: "Fixture",
      logo: null,
      branding: {
        organizationId: "org-fixture",
        pwaIcon192Url: "javascript:alert(1)",
        pwaIcon512Url: "//untrusted.example/icon.png",
        pwaMaskable192Url: null,
        pwaMaskable512Url: null,
      },
    });
    const manifest = buildOperationalAppManifest({ basePath: "/app", tenantBranding: branding });
    assert.deepEqual(manifest.icons, []);
    assert.equal(manifest.display, "browser");
    assert.equal(manifest.name, "Fixture");
    assert.ok(!JSON.stringify(manifest).includes("/icons/icon-"));
  });

  it("scopes identity and language to the origin, locale, and deployment path", () => {
    const branding = resolveTenantPwaBranding({
      organizationId: "org-en",
      name: "Example",
      logo: null,
      branding: { organizationId: "org-en", pwaIcon192Url: "/tenant/192.png", pwaIcon512Url: "/tenant/512.png", pwaMaskable192Url: "/tenant/m192.png", pwaMaskable512Url: "/tenant/m512.png" },
    });
    const manifest = buildOperationalAppManifest({ basePath: "", tenantBranding: branding, locale: "en" });
    assert.equal(manifest.start_url, "/en");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.lang, "en");
    assert.equal(manifest.dir, "ltr");
  });
});
