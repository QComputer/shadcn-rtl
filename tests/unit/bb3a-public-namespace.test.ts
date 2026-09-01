import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildAppointmentPlatformPath,
  buildLegacyPlatformCapabilityRedirect,
  buildOrganizationRootPath,
  buildOrganizationPublicPath,
  buildShopPlatformPath,
  CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES,
  getLegacyCustomDomainCapabilityRedirect,
  getAppointmentSubPathFromPlatformPath,
  classifyPublicSurfaceCapability,
  parseCustomDomainCapabilityPath,
  isReservedCustomDomainSurfaceSegment,
  parseLegacyPlatformCapabilityPath,
} from "@/lib/custom-domain-routing";
import { isReservedOrganizationSlug } from "@/lib/organization-slugs";
import { slugSchema } from "@/lib/validators";
import {
  buildShopCategoryPath,
  buildShopCheckoutPath,
  buildShopOrderPath,
  buildShopProductPath,
  buildShopProductsPath,
} from "@/lib/shop-public-paths";
import { resolveOrganizationPublicHome } from "@/lib/organization-public-home";

const shopInput = { locale: "fa", shopSlug: "tenant-a", isCustomDomain: true } as const;

describe("BB-3A custom-domain public namespace", () => {
  it("keeps every existing shop page beneath /shop", () => {
    assert.equal(buildShopProductsPath(shopInput), "/shop");
    assert.equal(buildShopCategoryPath({ ...shopInput, categorySegment: "coffee" }), "/shop/category/coffee");
    assert.equal(buildShopProductPath({ ...shopInput, productSegment: "latte" }), "/shop/product/latte");
    assert.equal(buildShopCheckoutPath(shopInput), "/shop/checkout");
    assert.equal(buildShopOrderPath({ ...shopInput, orderNumber: "ORD-1" }), "/shop/order/ORD-1");
  });

  it("keeps every supported appointment page beneath /appointment", () => {
    const path = (subPath = "/") => buildOrganizationPublicPath({
      locale: "fa",
      organizationSlug: "tenant-a",
      surface: "appointment",
      subPath,
      isCustomDomain: true,
    });

    assert.equal(path(), "/appointment");
    assert.equal(path("/services"), "/appointment/services");
    assert.equal(path("/services/category/hair"), "/appointment/services/category/hair");
    assert.equal(path("/services/cut"), "/appointment/services/cut");
    assert.equal(path("/booking"), "/appointment/booking");
    assert.equal(path("/my-appointments"), "/appointment/my-appointments");
    assert.equal(path("/my-appointments/APPT-1"), "/appointment/my-appointments/APPT-1");
    assert.doesNotMatch(path("/my-appointments/APPT-1"), /\/appointment\/appointment\//);
  });

  it("uses the organization-first platform hierarchy", () => {
    assert.equal(buildOrganizationRootPath({ locale: "fa", organizationSlug: "tenant-a" }), "/fa/tenant-a");
    assert.equal(buildShopPlatformPath({ locale: "fa", slug: "tenant-a", publicPathname: "/product/latte" }), "/fa/tenant-a/shop/product/latte");
    assert.equal(buildAppointmentPlatformPath({ locale: "fa", slug: "tenant-a", publicPathname: "/services/cut" }), "/fa/tenant-a/appointment/services/cut");
    assert.equal(buildAppointmentPlatformPath({ locale: "fa", slug: "tenant-a", publicPathname: "/my-appointments/APPT-1" }), "/fa/tenant-a/appointment/my-appointments/APPT-1");
  });

  it("preserves non-default locale prefixes without exposing organization slugs", () => {
    assert.equal(buildOrganizationPublicPath({ locale: "en", organizationSlug: "tenant-a", surface: "shop", subPath: "/product/latte", isCustomDomain: true }), "/en/shop/product/latte");
    assert.equal(buildOrganizationPublicPath({ locale: "ar", organizationSlug: "tenant-a", surface: "appointment", subPath: "/booking", isCustomDomain: true }), "/ar/appointment/booking");
  });

  it("maps capability paths to host-selected internal tenant routes", () => {
    const shopPath = parseCustomDomainCapabilityPath("/shop/product/product-owned-by-tenant-b");
    assert.deepEqual(shopPath, { locale: "fa", surface: "shop", subPath: "/product/product-owned-by-tenant-b" });
    assert.equal(
      buildShopPlatformPath({ locale: shopPath!.locale, slug: "tenant-a", publicPathname: shopPath!.subPath }),
      "/fa/tenant-a/shop/product/product-owned-by-tenant-b",
    );

    const appointmentPath = parseCustomDomainCapabilityPath("/appointment/services/service-owned-by-tenant-b");
    assert.equal(
      buildAppointmentPlatformPath({ locale: appointmentPath!.locale, slug: "tenant-a", publicPathname: appointmentPath!.subPath }),
      "/fa/tenant-a/appointment/services/service-owned-by-tenant-b",
    );
  });

  it("keeps syntactic classification separate from resolver-owned authorization", () => {
    assert.equal(classifyPublicSurfaceCapability("shop"), "SHOP");
    assert.equal(classifyPublicSurfaceCapability("appointment"), "APPOINTMENT");
    const mixedCapabilities = ["SHOP", "APPOINTMENT"];
    assert.equal(mixedCapabilities.includes(classifyPublicSurfaceCapability("shop")), true);
    assert.equal(mixedCapabilities.includes(classifyPublicSurfaceCapability("appointment")), true);
    assert.equal(["SHOP"].includes(classifyPublicSurfaceCapability("appointment")), false);

    const proxySource = readFileSync("proxy.ts", "utf8");
    assert.match(proxySource, /tenant\.capabilities\.includes\(requiredCapability\)/);
    assert.match(proxySource, /Path classification is syntactic; authorization remains here/);
  });

  it("redirects legacy escaped capability paths into their namespace", () => {
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/product/latte"), "/shop/product/latte");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/checkout"), "/shop/checkout");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/services/cut"), "/appointment/services/cut");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/booking"), "/appointment/booking");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/appointment/APPT-1"), "/appointment/my-appointments/APPT-1");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/appointment/appointment/APPT-1"), "/appointment/my-appointments/APPT-1");
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/appointment/services"), null);
    assert.equal(getLegacyCustomDomainCapabilityRedirect("/en/category/coffee"), "/en/shop/category/coffee");
  });

  it("canonicalizes only the host tenant's organization-first appointment path", () => {
    assert.deepEqual(getAppointmentSubPathFromPlatformPath("/fa/tenant-a/appointment/services/cut", "tenant-a"), {
      locale: "fa",
      subPath: "/services/cut",
    });
    assert.deepEqual(getAppointmentSubPathFromPlatformPath("/fa/tenant-a/appointment/my-appointments/APPT-1", "tenant-a"), {
      locale: "fa",
      subPath: "/my-appointments/APPT-1",
    });
    assert.equal(getAppointmentSubPathFromPlatformPath("/fa/tenant-b/appointment/services/cut", "tenant-a"), null);
    assert.equal(isReservedCustomDomainSurfaceSegment("appointment", "services"), true);
    assert.equal(isReservedCustomDomainSurfaceSegment("shop", "product"), true);
  });

  it("does not couple capability paths to PublicHomeMode", () => {
    const capabilities = [
      { key: "SHOP" as const, status: "ACTIVE" as const },
      { key: "APPOINTMENT" as const, status: "ACTIVE" as const },
    ];
    const modes = [
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "AUTO", settings: { defaultPublicCapability: "SHOP" } }),
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "SHOP" }),
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "APPOINTMENT" }),
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "BRAND", brandLandingProvider: "BAZARBAAZ" }),
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "VISITOR_CHOICE" }),
      resolveOrganizationPublicHome({ capabilities, publicHomeMode: "BRAND", brandLandingProvider: "CUSTOM_EXTERNAL" }),
    ];

    assert.equal(modes.length, 6);
    for (const publicHome of modes) {
      assert.ok(publicHome.kind);
      assert.equal(parseCustomDomainCapabilityPath("/shop")?.surface, "shop");
      assert.equal(parseCustomDomainCapabilityPath("/appointment")?.surface, "appointment");
    }

    const rootSource = readFileSync("app/[locale]/[slug]/page.tsx", "utf8");
    assert.match(rootSource, /publicHome\.capability === "SHOP"/);
    assert.match(rootSource, /publicHome\.capability === "APPOINTMENT"/);
    assert.match(rootSource, /publicHome\.kind === "brand"/);
    assert.match(rootSource, /publicHome\.kind === "visitor-choice"/);
  });

  it("keeps CUSTOM_EXTERNAL platform representation while failing closed at a custom-domain root", () => {
    const rootSource = readFileSync("app/[locale]/[slug]/page.tsx", "utf8");
    const proxySource = readFileSync("proxy.ts", "utf8");
    const externalRootSource = readFileSync("app/[locale]/external-root/[slug]/page.tsx", "utf8");

    assert.match(rootSource, /publicHome\.kind === "brand" \|\| publicHome\.kind === "external"/);
    assert.match(rootSource, /return <OrganizationBrandHome/);
    assert.match(proxySource, /publicHome\?\.kind === "external"/);
    assert.match(proxySource, /externalUrl\.pathname = `\/\$\{locale\}\/external-root\/\$\{tenant\.slug\}`/);
    assert.match(externalRootSource, /notFound\(\);/);
    assert.equal(parseCustomDomainCapabilityPath("/shop")?.surface, "shop");
    assert.equal(parseCustomDomainCapabilityPath("/appointment")?.surface, "appointment");
    assert.match(proxySource, /tenant\.capabilities\.includes\(requiredCapability\)/);
  });

  it("shares organization branding across root and both capability surfaces", () => {
    for (const file of [
      "app/[locale]/[slug]/page.tsx",
      "app/[locale]/[slug]/shop/layout.tsx",
      "app/[locale]/[slug]/appointment/layout.tsx",
    ]) {
      assert.match(readFileSync(file, "utf8"), /resolveOrganizationBranding/, file);
    }
  });

  it("uses namespace-aware sitemap paths and keeps transactional metadata noindex", () => {
    const sitemapSource = readFileSync("app/api/public/custom-domain/sitemap/route.ts", "utf8");
    assert.match(sitemapSource, /surface: "shop"/);
    assert.match(sitemapSource, /surface: "appointment"/);
    for (const file of [
      "app/[locale]/[slug]/shop/checkout/layout.tsx",
      "app/[locale]/[slug]/shop/order/[orderNumber]/layout.tsx",
      "app/[locale]/[slug]/appointment/booking/layout.tsx",
      "app/[locale]/[slug]/appointment/my-appointments/layout.tsx",
      "app/[locale]/[slug]/appointment/my-appointments/[id]/layout.tsx",
    ]) {
      assert.match(readFileSync(file, "utf8"), /buildNoIndexMetadata/);
    }
  });

  it("switches organization-root navigation only at the CUSTOM_EXTERNAL cross-zone boundary", () => {
    const proxySource = readFileSync("proxy.ts", "utf8");
    const rootLinkSource = readFileSync("components/public/organization-root-link.tsx", "utf8");
    assert.match(proxySource, /tenant\.publicHome\?\.kind === "external" \? "external" : "bazarbaaz"/);
    assert.match(rootLinkSource, /navigation\.mode === "hard"/);
    assert.match(rootLinkSource, /return <a href=\{navigation\.href\}/);
    assert.match(rootLinkSource, /return <Link href=\{navigation\.href\}/);

    for (const file of [
      "app/[locale]/[slug]/shop/layout.tsx",
      "app/[locale]/[slug]/appointment/layout.tsx",
    ]) {
      assert.match(readFileSync(file, "utf8"), /OrganizationRootNavigationProvider/);
    }
    assert.match(readFileSync("lib/contexts/organization-root-navigation-context.tsx", "utf8"), /mode: "next"/);
  });

  it("limits future edge ownership to explicit capability namespaces", () => {
    assert.deepEqual(CUSTOM_DOMAIN_CAPABILITY_EDGE_PREFIXES, ["/shop", "/appointment", "/purchase/product"]);
    const routingSource = readFileSync("lib/custom-domain-routing.ts", "utf8");
    assert.match(routingSource, /application-level compatibility redirects/);
    assert.match(routingSource, /not imply that an external edge/);
  });

  it("redirects capability-first platform URLs once and preserves queries", () => {
    assert.deepEqual(parseLegacyPlatformCapabilityPath("/fa/shop/tenant-a/product/latte"), {
      locale: "fa", slug: "tenant-a", surface: "shop", subPath: "/product/latte",
    });
    assert.deepEqual(parseLegacyPlatformCapabilityPath("/en/appointment/tenant-a/appointment/APPT-1"), {
      locale: "en", slug: "tenant-a", surface: "appointment", subPath: "/my-appointments/APPT-1",
    });
    assert.equal(buildLegacyPlatformCapabilityRedirect({
      locale: "fa", organizationSlug: "tenant-a", surface: "shop", legacySegments: ["category", "coffee"], searchParams: { page: "2", tag: ["hot", "new"] },
    }), "/fa/tenant-a/shop/category/coffee?page=2&tag=hot&tag=new");
    assert.equal(parseLegacyPlatformCapabilityPath("/fa/tenant-a/shop/product/latte"), null);
    const proxySource = readFileSync("proxy.ts", "utf8");
    assert.match(proxySource, /parseLegacyPlatformCapabilityPath\(pathname\)/);
    assert.match(proxySource, /NextResponse\.redirect\(redirectUrl, 308\)/);
  });

  it("reserves platform and system slugs before persistence", () => {
    for (const slug of ["shop", "appointment", "dashboard", "api", "_next", "organization", "brand", "visitor-choice"]) {
      assert.equal(isReservedOrganizationSlug(slug), true, slug);
      assert.equal(slugSchema.safeParse(slug).success, false, slug);
    }
    assert.equal(isReservedOrganizationSlug("cafe-leo"), false);
    assert.equal(slugSchema.safeParse("cafe-leo").success, true);
    assert.match(readFileSync("lib/services/organization.service.ts", "utf8"), /assertOrganizationSlugAllowed\(data\.slug\)/);
    assert.match(readFileSync("lib/business-acquisition/business-acquisition.service.ts", "utf8"), /assertOrganizationSlugAllowed\(input\.slug\)/);
    assert.match(readFileSync("app/api/auth/register/organization/route.ts", "utf8"), /orgSlug: slugSchema/);
  });

  it("keeps static locale routes alongside the dynamic organization root", () => {
    assert.equal(existsSync("app/[locale]/[slug]/page.tsx"), true);
    for (const entry of readdirSync("app/[locale]", { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "[slug]") {
        assert.equal(isReservedOrganizationSlug(entry.name), true, entry.name);
      }
    }
    for (const route of ["login", "dashboard"]) {
      assert.equal(isReservedOrganizationSlug(route), true);
      assert.equal(existsSync(`app/[locale]/${route}/page.tsx`) || existsSync(`app/[locale]/${route}/layout.tsx`), true, route);
    }
    assert.equal(isReservedOrganizationSlug("admin"), true);
    assert.equal(isReservedOrganizationSlug("explore"), true);
  });
});
