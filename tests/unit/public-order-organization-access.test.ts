import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, test } from "node:test";

// The route's database client is lazy; these tests only import its pure access
// policy and inspect the query contract, so no connection is opened.
process.env.DATABASE_URL ??= "postgresql://unit-test.invalid/unused";

let isOrganizationOrderReaderRole: (role: string) => boolean;
let readerRoles: readonly string[];
before(async () => {
  ({ isOrganizationOrderReaderRole, PUBLIC_ORDER_ORGANIZATION_READER_ROLES: readerRoles } =
    await import("../../lib/order-access-policy"));
});

test("only staff order-reader roles qualify for organization-wide order access", () => {
  assert.deepEqual(readerRoles, ["ADMIN", "MANAGER", "STAFF"]);
  for (const role of readerRoles) assert.equal(isOrganizationOrderReaderRole(role), true);
  for (const role of ["CUSTOMER", "USER", "DRIVER", "SUPER_ADMIN", "UNKNOWN"]) {
    assert.equal(isOrganizationOrderReaderRole(role), false, `${role} must not receive organization-wide order reads`);
  }
});

test("public order membership query stays tenant-bound and keeps explicit owner, guest, token, and platform access", async () => {
  const source = await readFile("app/api/public/orders/[orderNumber]/route.ts", "utf8");
  assert.match(source, /organizationSlug:\s*order\.organizationSlug/);
  assert.match(source, /role:\s*\{\s*in:\s*\[\.\.\.PUBLIC_ORDER_ORGANIZATION_READER_ROLES\]\s*\}/);
  assert.match(source, /isOwner/);
  assert.match(source, /isSameGuestSession/);
  assert.match(source, /isTrackingTokenMatch/);
  assert.match(source, /isSuperAdmin/);
});
