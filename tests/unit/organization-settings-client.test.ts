import assert from "node:assert/strict";
import test from "node:test";
import {
  loadOrganizationSettings,
  organizationSettingsApiPath,
  OrganizationSettingsScopeError,
  requestOrganizationSettings,
  resolveOrganizationSettingsId,
} from "@/lib/organization-settings-client";

const restaurantMembership = { organizationId: "restaurant-13-id" };
const anotherMembership = { organizationId: "other-tenant-id" };

test("initial load, direct navigation, and refresh use the authenticated active membership", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    return {
      ok: true,
      status: 200,
      json: async () => url === "/api/users/me/membership"
        ? { memberships: [restaurantMembership] }
        : { organization: { id: "restaurant-13-id" } },
    } as Response;
  };
  const session = { role: "ADMIN", organizationId: restaurantMembership.organizationId };

  for (const navigation of ["initial", "direct", "refresh"]) {
    const result = await loadOrganizationSettings(fetcher, session);
    assert.equal(result.organizationId, restaurantMembership.organizationId, navigation);
  }

  assert.deepEqual(requests.filter((request) => request.url.endsWith("/settings")), [
    { url: "/api/organizations/restaurant-13-id/settings", method: "GET" },
    { url: "/api/organizations/restaurant-13-id/settings", method: "GET" },
    { url: "/api/organizations/restaurant-13-id/settings", method: "GET" },
  ]);
  assert.equal(requests.some((request) => request.url.includes("noId")), false);
});

test("a selected membership change uses only the newly session-authorized organization", () => {
  const selected = resolveOrganizationSettingsId({
    session: { role: "MANAGER", organizationId: anotherMembership.organizationId },
    memberships: [restaurantMembership, anotherMembership],
  });
  assert.equal(selected, anotherMembership.organizationId);
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

test("missing and placeholder ids never issue an organization settings request", async () => {
  const requests: string[] = [];
  const fetcher = async (url: string) => {
    requests.push(url);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };

  assert.equal(organizationSettingsApiPath("noId"), null);
  assert.equal(organizationSettingsApiPath("undefined"), null);
  assert.equal(organizationSettingsApiPath(null), null);
  await assert.rejects(
    requestOrganizationSettings(fetcher, "noId"),
    (error: unknown) => error instanceof OrganizationSettingsScopeError && error.reason === "missing",
  );
  assert.deepEqual(requests, []);
});

test("settings GET and PUT target the validated organization id", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    requests.push({ url, method: init?.method ?? "GET" });
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };

  await requestOrganizationSettings(fetcher, restaurantMembership.organizationId, { method: "GET" });
  await requestOrganizationSettings(fetcher, restaurantMembership.organizationId, { method: "PUT" });
  assert.deepEqual(requests, [
    { url: "/api/organizations/restaurant-13-id/settings", method: "GET" },
    { url: "/api/organizations/restaurant-13-id/settings", method: "PUT" },
  ]);
});
