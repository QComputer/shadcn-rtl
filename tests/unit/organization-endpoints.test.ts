import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  joinOrganizationEndpointPath,
  readOrganizationEndpointDefinitions,
  resolveOrganizationApiEndpoint,
  resolveOrganizationAppEndpoint,
  resolveOrganizationCallbackEndpoint,
  resolveOrganizationPublicEndpoint,
} from "@/lib/organization-endpoints";

const organizationId = "org-a";
const activeDomain = {
  id: "domain-a",
  organizationId,
  normalizedDomain: "Tenant.Example.",
  status: "ACTIVE",
  providerVerified: true,
  dnsConfigured: true,
  sslReady: true,
  deletedAt: null,
};

function settings(...endpoints: Record<string, unknown>[]) {
  return { organizationEndpoints: endpoints };
}

describe("organization endpoint foundation", () => {
  it("represents PUBLIC, APP, API, and CALLBACK independently from capabilities", () => {
    const configured = settings(
      { role: "PUBLIC", origin: "https://tenant.example" },
      { role: "APP", origin: "https://app.tenant.example" },
      { role: "API", organizationDomainId: "domain-a", pathPrefix: "/api/v1" },
      { role: "CALLBACK", organizationDomainId: "domain-a", pathPrefix: "/callbacks" },
    );
    const input = { organizationId, settings: configured, domains: [activeDomain] };
    assert.equal(resolveOrganizationPublicEndpoint(input)?.baseUrl, "https://tenant.example");
    assert.equal(resolveOrganizationAppEndpoint(input)?.baseUrl, "https://app.tenant.example");
    assert.equal(resolveOrganizationApiEndpoint(input)?.baseUrl, "https://tenant.example/api/v1");
    assert.equal(resolveOrganizationCallbackEndpoint(input)?.baseUrl, "https://tenant.example/callbacks");
    assert.equal("capabilities" in configured, false);
  });

  it("supports an app subdomain topology", () => {
    const endpoint = resolveOrganizationAppEndpoint({
      organizationId,
      settings: settings({ role: "APP", origin: "https://app.tenant.example" }),
    });
    assert.equal(endpoint?.origin, "https://app.tenant.example");
    assert.equal(endpoint?.pathPrefix, "");
  });

  it("supports an /app path-prefix topology and safe path/query joining", () => {
    const endpoint = resolveOrganizationAppEndpoint({
      organizationId,
      settings: settings({ role: "APP", origin: "https://tenant.example", pathPrefix: "/app/" }),
    });
    assert.equal(endpoint?.baseUrl, "https://tenant.example/app");
    assert.equal(joinOrganizationEndpointPath(endpoint!, "/product/stable-id?source=website"), "https://tenant.example/app/product/stable-id?source=website");
  });

  it("supports a Bazarbaaz-managed public domain without coupling APP policy", () => {
    const input = {
      organizationId,
      settings: settings({ role: "PUBLIC", organizationDomainId: "domain-a" }),
      domains: [activeDomain],
    };
    assert.equal(resolveOrganizationPublicEndpoint(input)?.source, "ORGANIZATION_DOMAIN");
    assert.equal(resolveOrganizationAppEndpoint(input), null);
  });

  it("returns explicit absence and never invents cross-role fallbacks", () => {
    const input = { organizationId, settings: settings({ role: "PUBLIC", origin: "https://tenant.example" }) };
    assert.equal(resolveOrganizationAppEndpoint(input), null);
    assert.equal(resolveOrganizationApiEndpoint(input), null);
    assert.equal(resolveOrganizationCallbackEndpoint(input), null);
  });

  it("normalizes origins and path prefixes", () => {
    const endpoint = resolveOrganizationPublicEndpoint({
      organizationId,
      settings: settings({ role: "PUBLIC", origin: "  HTTPS://WWW.Tenant.Example./  ", pathPrefix: "/site/" }),
    });
    assert.equal(endpoint?.baseUrl, "https://tenant.example/site");
  });

  it("rejects malformed definitions, duplicate roles, and platform hosts", () => {
    assert.throws(() => resolveOrganizationAppEndpoint({ organizationId, settings: settings({ role: "APP", origin: "http://tenant.example" }) }), /HTTPS/);
    assert.throws(() => resolveOrganizationAppEndpoint({ organizationId, settings: settings({ role: "APP", origin: "https://tenant.example/app" }) }), /must not contain/);
    assert.throws(() => readOrganizationEndpointDefinitions(settings({ role: "APP", origin: "https://tenant.example", pathPrefix: "app" })), /absolute path/);
    assert.throws(() => readOrganizationEndpointDefinitions(settings(
      { role: "APP", origin: "https://app.tenant.example" },
      { role: "APP", origin: "https://other.tenant.example" },
    )), /unique/);
    assert.throws(() => resolveOrganizationPublicEndpoint({ organizationId, settings: settings({ role: "PUBLIC", origin: "https://bazarbaaz.ir" }) }), /Platform hosts/);
  });

  it("preserves OrganizationDomain tenant ownership and active verification semantics", () => {
    const configured = settings({ role: "PUBLIC", organizationDomainId: "domain-a" });
    assert.throws(() => resolveOrganizationPublicEndpoint({
      organizationId: "org-b",
      settings: configured,
      domains: [activeDomain],
    }), /does not belong/);
    for (const invalidDomain of [
      { ...activeDomain, status: "VERIFYING" },
      { ...activeDomain, providerVerified: false },
      { ...activeDomain, dnsConfigured: false },
      { ...activeDomain, sslReady: false },
      { ...activeDomain, deletedAt: new Date() },
    ]) {
      assert.throws(() => resolveOrganizationPublicEndpoint({ organizationId, settings: configured, domains: [invalidDomain] }), /not active and verified/);
    }
  });

  it("rejects cross-origin path joins", () => {
    const endpoint = resolveOrganizationAppEndpoint({ organizationId, settings: settings({ role: "APP", origin: "https://app.tenant.example" }) });
    assert.throws(() => joinOrganizationEndpointPath(endpoint!, "https://evil.example/path"), /absolute same-origin path/);
    assert.throws(() => joinOrganizationEndpointPath(endpoint!, "//evil.example/path"), /absolute same-origin path/);
    assert.throws(() => joinOrganizationEndpointPath(endpoint!, "/../admin"), /dot segments/);
  });
});
