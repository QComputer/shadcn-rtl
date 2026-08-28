import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveOrganizationBranding,
  resolvePlatformFallbackBranding,
} from "@/lib/organization-branding";

describe("organization branding resolution", () => {
  it("resolves organization-specific branding when present", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-1",
      name: "Cafe Leo",
      logo: "/cafe-leo-logo.png",
      coverImage: "/cafe-leo-cover.jpg",
      branding: {
        organizationId: "org-1",
        displayName: "Café Léo",
        shortName: "Leo",
        logoUrl: "/cafe-leo-logo-brand.png",
        faviconUrl: "/cafe-leo-favicon.ico",
        appleTouchIconUrl: "/cafe-leo-apple.png",
        pwaIcon192Url: "/cafe-leo-pwa-192.png",
        pwaIcon512Url: "/cafe-leo-pwa-512.png",
        ogImageUrl: "/cafe-leo-og.jpg",
        source: "EXTERNAL_SYNC",
      },
    });

    assert.equal(branding.organizationId, "org-1");
    assert.equal(branding.displayName, "Café Léo");
    assert.equal(branding.shortName, "Leo");
    assert.equal(branding.logo, "/cafe-leo-logo-brand.png");
    assert.equal(branding.favicon, "/cafe-leo-favicon.ico");
    assert.equal(branding.appleTouchIcon, "/cafe-leo-apple.png");
    assert.equal(branding.pwaIcons.icon192, "/cafe-leo-pwa-192.png");
    assert.equal(branding.pwaIcons.icon512, "/cafe-leo-pwa-512.png");
    assert.equal(branding.ogImage, "/cafe-leo-og.jpg");
    assert.equal(branding.source, "EXTERNAL_SYNC");
  });

  it("falls back to organization logo when branding record is missing", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-2",
      name: "Test Org",
      logo: "/test-logo.png",
      coverImage: "/test-cover.jpg",
      branding: null,
    });

    assert.equal(branding.displayName, "Test Org");
    assert.equal(branding.shortName, "Test Org");
    assert.equal(branding.logo, "/test-logo.png");
    assert.equal(branding.favicon, "/pwa-icon.svg");
    assert.equal(branding.appleTouchIcon, "/pwa-icon.svg");
    assert.equal(branding.pwaIcons.icon192, "/pwa-icon.svg");
    assert.equal(branding.pwaIcons.icon512, "/pwa-icon.svg");
    assert.equal(branding.ogImage, "/test-cover.jpg");
    assert.equal(branding.source, "PLATFORM_FALLBACK");
  });

  it("falls back to Bazarbaaz assets when organization has no logo/cover", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-3",
      name: "Bare Org",
      logo: null,
      coverImage: null,
      branding: {
        organizationId: "org-3",
        faviconUrl: "/custom-favicon.ico",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.equal(branding.logo, "/pwa-icon.svg");
    assert.equal(branding.favicon, "/custom-favicon.ico");
    assert.equal(branding.appleTouchIcon, "/custom-favicon.ico");
    assert.equal(branding.pwaIcons.icon192, "/pwa-icon.svg");
    assert.equal(branding.pwaIcons.icon512, "/pwa-icon.svg");
    assert.equal(branding.ogImage, "/og-image");
  });

  it("never returns Next.js default branding", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-4",
      name: "Minimal Org",
      logo: null,
      coverImage: null,
      branding: null,
    });

    assert.notEqual(branding.favicon, "/favicon.ico");
    assert.notEqual(branding.appleTouchIcon, "/favicon.ico");
    assert.notEqual(branding.pwaIcons.icon192, "/favicon.ico");
    assert.notEqual(branding.pwaIcons.icon512, "/favicon.ico");
    assert.notEqual(branding.ogImage, "/favicon.ico");
  });

  it("platform fallback returns safe Bazarbaaz branding", () => {
    const fallback = resolvePlatformFallbackBranding();

    assert.equal(fallback.organizationId, "platform");
    assert.equal(fallback.displayName, "Bazar Baz");
    assert.equal(fallback.logo, "/pwa-icon.svg");
    assert.equal(fallback.favicon, "/pwa-icon.svg");
    assert.equal(fallback.appleTouchIcon, "/pwa-icon.svg");
    assert.equal(fallback.pwaIcons.icon192, "/pwa-icon.svg");
    assert.equal(fallback.pwaIcons.icon512, "/pwa-icon.svg");
    assert.equal(fallback.ogImage, "/og-image");
    assert.equal(fallback.source, "PLATFORM_FALLBACK");
  });

  it("uses organization name when displayName/shortName are missing", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-5",
      name: "My Shop",
      logo: null,
      coverImage: null,
      branding: {
        organizationId: "org-5",
        source: "EXTERNAL_SYNC",
      },
    });

    assert.equal(branding.displayName, "My Shop");
    assert.equal(branding.shortName, "My Shop");
    assert.equal(branding.logo, "/pwa-icon.svg");
    assert.equal(branding.favicon, "/pwa-icon.svg");
  });

  it("does not leak cross-tenant assets", () => {
    const brandingA = resolveOrganizationBranding({
      organizationId: "org-a",
      name: "Org A",
      logo: "/org-a-logo.png",
      coverImage: "/org-a-cover.jpg",
      branding: {
        organizationId: "org-a",
        logoUrl: "/org-a-logo-brand.png",
        faviconUrl: "/org-a-favicon.ico",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    const brandingB = resolveOrganizationBranding({
      organizationId: "org-b",
      name: "Org B",
      logo: "/org-b-logo.png",
      coverImage: "/org-b-cover.jpg",
      branding: {
        organizationId: "org-b",
        logoUrl: "/org-b-logo-brand.png",
        faviconUrl: "/org-b-favicon.ico",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.notEqual(brandingA.favicon, brandingB.favicon);
    assert.notEqual(brandingA.ogImage, brandingB.ogImage);
    assert.notEqual(brandingA.logo, brandingB.logo);
    assert.equal(brandingA.organizationId, "org-a");
    assert.equal(brandingB.organizationId, "org-b");
  });

  it("prefers branding logoUrl over organization logo", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-6",
      name: "Test Org",
      logo: "/org-logo.png",
      coverImage: "/org-cover.jpg",
      branding: {
        organizationId: "org-6",
        logoUrl: "/brand-logo.png",
        faviconUrl: "/brand-favicon.ico",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.equal(branding.logo, "/brand-logo.png");
    assert.equal(branding.favicon, "/brand-favicon.ico");
  });

  it("falls back to organization logo for favicon when branding favicon is missing", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-7",
      name: "Test Org",
      logo: "/org-logo.png",
      coverImage: "/org-cover.jpg",
      branding: {
        organizationId: "org-7",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.equal(branding.logo, "/org-logo.png");
    assert.equal(branding.favicon, "/pwa-icon.svg");
    assert.equal(branding.appleTouchIcon, "/pwa-icon.svg");
  });

  it("uses organization logo for ogImage when branding ogImage is missing", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-8",
      name: "Test Org",
      logo: "/org-logo.png",
      coverImage: "/org-cover.jpg",
      branding: {
        organizationId: "org-8",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.equal(branding.ogImage, "/org-cover.jpg");
  });

  it("falls back to Bazarbaaz og-image when no logo or cover exists", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-9",
      name: "Bare Org",
      logo: null,
      coverImage: null,
      branding: {
        organizationId: "org-9",
        source: "PLATFORM_FALLBACK",
      },
    });

    assert.equal(branding.ogImage, "/og-image");
  });

  it("branding is independent of capabilities and public home mode", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-10",
      name: "Test Org",
      logo: "/org-logo.png",
      coverImage: "/org-cover.jpg",
      branding: {
        organizationId: "org-10",
        logoUrl: "/brand-logo.png",
        faviconUrl: "/brand-favicon.ico",
        source: "BAZARBAAZ_MANAGED",
      },
    });

    assert.equal(branding.logo, "/brand-logo.png");
    assert.equal(branding.favicon, "/brand-favicon.ico");
    assert.equal(branding.source, "BAZARBAAZ_MANAGED");
  });

  it("ignores a branding record owned by another organization", () => {
    const branding = resolveOrganizationBranding({
      organizationId: "org-a",
      name: "Org A",
      logo: "/org-a-logo.png",
      coverImage: "/org-a-cover.jpg",
      branding: {
        organizationId: "org-b",
        displayName: "Org B",
        logoUrl: "/org-b-logo.png",
        faviconUrl: "/org-b-favicon.ico",
        ogImageUrl: "/org-b-og.jpg",
        source: "EXTERNAL_SYNC",
      },
    });

    assert.equal(branding.displayName, "Org A");
    assert.equal(branding.logo, "/org-a-logo.png");
    assert.equal(branding.favicon, "/pwa-icon.svg");
    assert.equal(branding.ogImage, "/org-a-cover.jpg");
    assert.equal(branding.source, "PLATFORM_FALLBACK");
  });
});
