import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = readFileSync(
  path.join(process.cwd(), "prisma", "migrations", "20260926170000_canonical_restaurant13_identity", "migration.sql"),
  "utf8",
);

test("Restaurant 13 canonical identity migration is additive and guarded", () => {
  assert.match(migration, /UPDATE "Organization" SET slug = 'fastfood13' WHERE slug = 'italiano-13'/);
  assert.match(migration, /RAISE EXCEPTION 'Cannot migrate Restaurant 13: fastfood13 is already used by another organization'/);
  assert.match(migration, /CREATE TEMP TABLE _restaurant13_slug_foreign_keys/);
  assert.match(migration, /organizationSlug/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/);
});

test("Restaurant 13 runtime identity uses the canonical slug and asset namespace", async () => {
  const homeContent = await import("../../lib/organization-home-content");
  const resolved = homeContent.resolveOrganizationHomeContent({ organizationSlug: "fastfood13", locale: "fa" });
  assert.ok(resolved);
  assert.match(resolved.hero.desktopImage.src, /\/brand\/tenants\/fastfood13\//);
  assert.equal(homeContent.resolveOrganizationHomeContent({ organizationSlug: "italiano-13", locale: "fa" }), null);
});

test("Restaurant 13 iNoti profile keeps a legacy env read fallback", async () => {
  const source = readFileSync(path.join(process.cwd(), "lib", "integrations", "inoti-ussd", "credentials.ts"), "utf8");
  assert.match(source, /INOTI_FASTFOOD13_USERNAME/);
  assert.match(source, /INOTI_ITALIANO13_USERNAME/);
  assert.match(source, /readEnv\(definition\.usernameEnv, definition\.legacyUsernameEnv\)/);
});
