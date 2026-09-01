import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { resolveTrustedForwardedAppTenant } from "@/lib/forwarded-app-resolver.server";

const VALID_TOKEN = "a".repeat(32);
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slug = `bb3b-forwarded-${runId}`;
const forwardedHost = "app.forwarded.test";
let organizationId = "";

describe("forwarded app resolver database integration", () => {
  const originalToken = process.env.BAZARBAAZ_APP_PROXY_TOKEN;

  before(async () => {
    process.env.BAZARBAAZ_APP_PROXY_TOKEN = VALID_TOKEN;
    const org = await prisma.organization.create({
      data: {
        type: "SHOP",
        name: "BB-3B Forwarded Test",
        slug,
      },
    });
    organizationId = org.id;

    await prisma.organizationSettings.create({
      data: {
        organizationSlug: slug,
        settings: {
          organizationEndpoints: [
            {
              role: "APP",
              origin: `https://${forwardedHost}`,
              pathPrefix: "/app",
            },
          ],
        },
      },
    });
  });

  after(async () => {
    await prisma.organizationSettings.deleteMany({ where: { organizationSlug: slug } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
    if (originalToken === undefined) {
      delete process.env.BAZARBAAZ_APP_PROXY_TOKEN;
    } else {
      process.env.BAZARBAAZ_APP_PROXY_TOKEN = originalToken;
    }
  });

  it("resolves a valid forwarded APP request with correct token and path", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost,
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.tenant.organizationId, organizationId);
      assert.equal(result.tenant.slug, slug);
      assert.equal(result.tenant.endpoint.origin, `https://${forwardedHost}`);
      assert.equal(result.tenant.endpoint.pathPrefix, "/app");
    }
  });

  it("resolves nested paths under /app", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost,
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/purchase/product/prod-123",
    });
    assert.equal(result.status, "resolved");
  });

  it("rejects request outside /app prefix", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost,
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/some-other-path",
    });
    assert.equal(result.status, "no-tenant");
  });

  it("rejects wrong proxy token", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost,
      proxyCredential: "b".repeat(32),
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("rejects missing proxy token", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost,
      proxyCredential: "",
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "unauthorized");
  });

  it("returns no-tenant for unknown forwarded host", async () => {
    const result = await resolveTrustedForwardedAppTenant({
      forwardedHost: "unknown.host.example",
      proxyCredential: VALID_TOKEN,
      appBasePath: "/app",
      pathname: "/app/",
    });
    assert.equal(result.status, "no-tenant");
  });
});
