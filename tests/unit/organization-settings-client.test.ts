import assert from "node:assert/strict";
import test from "node:test";
import {
  loadOrganizationSettings,
  organizationSettingsApiPath,
  OrganizationSettingsScopeError,
  requestOrganizationSettings,
  resolveOrganizationSettingsId,
} from "@/lib/organization-settings-client";

const restaurantMembership = { organizationId: "c123456789012345678901234" };
const anotherMembership = { organizationId: "c123456789012345678901235" };

test("initial load, direct navigation, and refresh use the authenticated active membership", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    return {
      ok: true,
      status: 200,
      json: async () => url === "/api/users/me/membership"
        ? { memberships: [restaurantMembership] }
        : { organization: { id: restaurantMembership.organizationId } },
    } as Response;
  };
  const session = { role: "ADMIN", organizationId: restaurantMembership.organizationId };

  for (const navigation of ["initial", "direct", "refresh"]) {
    const result = await loadOrganizationSettings(fetcher, session);
    assert.equal(result.organizationId, restaurantMembership.organizationId, navigation);
  }

  assert.deepEqual(requests.filter((request) => request.url.endsWith("/settings")), [
    { url: "/api/organizations/c123456789012345678901234/settings", method: "GET" },
    { url: "/api/organizations/c123456789012345678901234/settings", method: "GET" },
    { url: "/api/organizations/c123456789012345678901234/settings", method: "GET" },
  ]);
  assert.equal(requests.some((request) => request.url.includes("noId")), false);
});

test("a selected membership change uses only the newly session-authorized organization", async () => {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => url === "/api/users/me/membership"
        ? { memberships: [restaurantMembership, anotherMembership] }
        : { organization: { id: url.split("/")[3] } },
    } as Response;
  };

  const first = await loadOrganizationSettings(fetcher, {
    role: "ADMIN",
    organizationId: restaurantMembership.organizationId,
  });
  const switched = await loadOrganizationSettings(fetcher, {
    role: "ADMIN",
    organizationId: anotherMembership.organizationId,
  });

  const selected = resolveOrganizationSettingsId({
    session: { role: "MANAGER", organizationId: anotherMembership.organizationId },
    memberships: [restaurantMembership, anotherMembership],
  });
  assert.equal(first.organizationId, restaurantMembership.organizationId);
  assert.equal(switched.organizationId, anotherMembership.organizationId);
  assert.equal(selected, anotherMembership.organizationId);
  assert.deepEqual(requests.filter((url) => url.endsWith("/settings")), [
    "/api/organizations/c123456789012345678901234/settings",
    "/api/organizations/c123456789012345678901235/settings",
  ]);
});

test("a stale session organization, missing id, or unauthorized URL selection fails closed", () => {
  assert.equal(resolveOrganizationSettingsId({
    session: { role: "ADMIN", organizationId: "stale-organization-id" },
    memberships: [restaurantMembership],
  }), null);
  assert.equal(resolveOrganizationSettingsId({
    session: { role: "ADMIN", organizationId: null },
    memberships: [restaurantMembership],
  }), null);
  assert.equal(resolveOrganizationSettingsId({
    session: { role: "ADMIN", organizationId: restaurantMembership.organizationId },
    requestedOrganizationId: anotherMembership.organizationId,
    memberships: [restaurantMembership, anotherMembership],
  }), null);
});

test("SUPER_ADMIN requires an explicit organization selection", () => {
  assert.equal(resolveOrganizationSettingsId({
    session: { role: "SUPER_ADMIN", organizationId: null },
  }), null);
  assert.equal(resolveOrganizationSettingsId({
    session: { role: "SUPER_ADMIN", organizationId: null },
    requestedOrganizationId: restaurantMembership.organizationId,
  }), restaurantMembership.organizationId);
});

test("a foreign URL selection fails before a scoped settings request is sent", async () => {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ memberships: [restaurantMembership, anotherMembership] }),
    } as Response;
  };

  await assert.rejects(
    loadOrganizationSettings(
      fetcher,
      { role: "ADMIN", organizationId: restaurantMembership.organizationId },
      anotherMembership.organizationId,
    ),
    (error: unknown) => error instanceof OrganizationSettingsScopeError && error.reason === "forbidden",
  );
  assert.deepEqual(requests, ["/api/users/me/membership"]);
});

test("missing and placeholder ids never issue an organization settings request", async () => {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };

  assert.equal(organizationSettingsApiPath("noId"), null);
  assert.equal(organizationSettingsApiPath("undefined"), null);
  assert.equal(organizationSettingsApiPath("bad/id"), null);
  assert.equal(organizationSettingsApiPath("bad\\id"), null);
  assert.equal(organizationSettingsApiPath("legacy_org_shop"), "/api/organizations/legacy_org_shop/settings");
  assert.equal(organizationSettingsApiPath("legacy-tenant-13"), "/api/organizations/legacy-tenant-13/settings");
  assert.equal(organizationSettingsApiPath(null), null);
  await assert.rejects(
    requestOrganizationSettings(fetcher, "noId"),
    (error: unknown) => error instanceof OrganizationSettingsScopeError && error.reason === "missing",
  );
  assert.deepEqual(requests, []);
});

test("settings GET, PATCH, and PUT target the validated organization id", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };

  await requestOrganizationSettings(fetcher, restaurantMembership.organizationId, { method: "GET" });
  await requestOrganizationSettings(fetcher, restaurantMembership.organizationId, { method: "PATCH" });
  await requestOrganizationSettings(fetcher, restaurantMembership.organizationId, { method: "PUT" });
  assert.deepEqual(requests, [
    { url: "/api/organizations/c123456789012345678901234/settings", method: "GET" },
    { url: "/api/organizations/c123456789012345678901234/settings", method: "PATCH" },
    { url: "/api/organizations/c123456789012345678901234/settings", method: "PUT" },
  ]);
});
