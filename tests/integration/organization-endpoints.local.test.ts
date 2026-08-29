import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { resolveOrganizationEndpointForTenant } from "@/lib/organization-endpoints.server";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slugA = `bb3b-a-${runId}`;
const slugB = `bb3b-b-${runId}`;
let organizationAId = "";
let organizationBId = "";
let domainAId = "";

describe("organization endpoint local persistence integration", () => {
  before(async () => {
    const [organizationA, organizationB] = await prisma.$transaction([
      prisma.organization.create({ data: { type: "SHOP", name: "BB-3B A", slug: slugA } }),
      prisma.organization.create({ data: { type: "APPOINTMENT", name: "BB-3B B", slug: slugB } }),
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const domain = await prisma.organizationDomain.create({
      data: {
        organizationId: organizationAId,
        domain: `${slugA}.example.test`,
        normalizedDomain: `${slugA}.example.test`,
        status: "ACTIVE",
        providerVerified: true,
        dnsConfigured: true,
        sslReady: true,
      },
    });
    domainAId = domain.id;

    await prisma.organizationSettings.create({
      data: {
        organizationSlug: slugA,
        settings: {
          organizationEndpoints: [
            { role: "PUBLIC", organizationDomainId: domainAId },
            { role: "APP", origin: "https://app.tenant.example" },
          ],
        },
      },
    });
    await prisma.organizationSettings.create({
      data: {
        organizationSlug: slugB,
        settings: { organizationEndpoints: [{ role: "PUBLIC", organizationDomainId: domainAId }] },
      },
    });
  });

  after(async () => {
    await prisma.organizationSettings.deleteMany({ where: { organizationSlug: { in: [slugA, slugB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
    await prisma.$disconnect();
  });

  it("resolves persisted endpoint settings against the tenant's active domain", async () => {
    const endpoint = await resolveOrganizationEndpointForTenant({ organizationId: organizationAId, role: "PUBLIC" });
    assert.equal(endpoint?.organizationDomainId, domainAId);
    assert.equal(endpoint?.source, "ORGANIZATION_DOMAIN");
  });

  it("returns explicit absence for an unconfigured role", async () => {
    assert.equal(await resolveOrganizationEndpointForTenant({ organizationId: organizationAId, role: "API" }), null);
  });

  it("rejects a domain reference owned by another tenant", async () => {
    await assert.rejects(
      resolveOrganizationEndpointForTenant({ organizationId: organizationBId, role: "PUBLIC" }),
      /does not belong/,
    );
  });
});
