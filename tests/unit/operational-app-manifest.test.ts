import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOperationalAppManifest } from "@/lib/operational-app-manifest";
import { resolveTenantPwaBranding } from "@/lib/organization-branding";

describe("operational app manifest", () => {
  it("keeps the platform fallback inside each build topology", () => {
    const root = buildOperationalAppManifest({ basePath: "" });
    const path = buildOperationalAppManifest({ basePath: "/app" });
    assert.equal(root.name, "بازارباز");
    assert.equal(root.short_name, "بازارباز");
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

  it("starts a path-based Retail tenant on its exact storefront on root and /app deployments", () => {
    const branding = resolveTenantPwaBranding({
      organizationId: "org-fashion",
      name: "Aka Shoes",
      logo: "/brand/tenants/aka-shoes/brand/aka-shoes-logo-square-brand-1024.png",
      branding: {
        organizationId: "org-fashion",
        displayName: "آکا شوز",
        shortName: "آکا",
        retailPresentationTheme: "FASHION",
        pwaIcon192Url: "/brand/tenants/aka-shoes/pwa/icon-192x192.png",
        pwaIcon512Url: "/brand/tenants/aka-shoes/pwa/icon-512x512.png",
        pwaMaskable192Url: "/brand/tenants/aka-shoes/pwa/maskable-192x192.png",
        pwaMaskable512Url: "/brand/tenants/aka-shoes/pwa/maskable-512x512.png",
      },
    });
    const root = buildOperationalAppManifest({ basePath: "", tenantBranding: branding, tenantStartPath: "/fa/retail/aka-shoes" });
    const app = buildOperationalAppManifest({ basePath: "/app", tenantBranding: branding, tenantStartPath: "/fa/retail/aka-shoes" });
    assert.equal(root.name, "آکا شوز");
    assert.equal(root.start_url, "/fa/retail/aka-shoes");
    assert.equal(root.id, "/fa/retail/aka-shoes");
    assert.equal(root.scope, "/fa/retail/aka-shoes");
    assert.equal(app.start_url, "/app/fa/retail/aka-shoes");
    assert.equal(app.id, "/app/fa/retail/aka-shoes");
    assert.equal(app.scope, "/app/fa/retail/aka-shoes");
  });

  it("uses the canonical tenant shop entry on verified tenant hosts", () => {
    const branding = resolveTenantPwaBranding({ organizationId: "org-custom", name: "Tenant Store", logo: null, branding: {
      organizationId: "org-custom",
      displayName: "Tenant Store",
      pwaIcon192Url: "/tenant/icon-192.png",
      pwaIcon512Url: "/tenant/icon-512.png",
      pwaMaskable192Url: "/tenant/maskable-192.png",
      pwaMaskable512Url: "/tenant/maskable-512.png",
    } });
    const manifest = buildOperationalAppManifest({ basePath: "/app", tenantBranding: branding, tenantStartPath: "/fa/shop" });
    assert.equal(manifest.start_url, "/app/fa/shop");
    assert.equal(manifest.id, "/app/fa/shop");
    assert.equal(manifest.scope, "/app/");
    assert.equal(manifest.display, "standalone");
  });

  it("rejects untrusted storefront paths and leaves incomplete tenants non-installable", () => {
    const branding = resolveTenantPwaBranding({
      organizationId: "org-incomplete",
      name: "Incomplete Store",
      logo: null,
      branding: { organizationId: "org-incomplete", displayName: "Incomplete Store", retailPresentationTheme: "GENERAL" },
    });
    const manifest = buildOperationalAppManifest({ basePath: "/app", tenantBranding: branding, tenantStartPath: "https://evil.example/fa/retail/victim" });
    assert.equal(manifest.start_url, "/app/fa");
    assert.equal(manifest.display, "browser");
    assert.equal(manifest.icons?.length, 0);
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
