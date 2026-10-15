import assert from "node:assert/strict";
import test from "node:test";
import { publicUserSelect, toPublicUserDto } from "@/lib/services/user-public-dto";

type UserInput = Parameters<typeof toPublicUserDto>[0];
type MembershipInput = UserInput["memberOf"][number];
type UserWithUntrustedExtras = UserInput & {
  password: string;
  resetToken: string;
  authToken: string;
  failedLoginAttempts: number;
  lockedUntil: Date;
  deletedAt: Date;
  extraNested: string;
  memberOf: Array<MembershipInput & {
    password: string;
    resetToken: string;
    authToken: string;
    extraNested: string;
  }>;
};

const fixture: UserWithUntrustedExtras = {
  id: "user-1",
  name: "member@example.test",
  role: "MANAGER",
  isActive: true,
  isTeamMember: true,
  email: "member@example.test",
  firstName: "Test",
  lastName: "Member",
  phone: "+10000000000",
  avatar: null,
  image: null,
  locale: "en",
  theme: "light",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  password: "password-sentinel",
  resetToken: "reset-token-sentinel",
  authToken: "auth-token-sentinel",
  failedLoginAttempts: 7,
  lockedUntil: new Date("2026-01-03T00:00:00.000Z"),
  deletedAt: new Date("2026-01-04T00:00:00.000Z"),
  extraNested: "top-level-extra-sentinel",
  memberOf: [{
    id: "membership-1",
    organizationId: "org-1",
    organizationSlug: "example-org",
    role: "MANAGER",
    isActive: true,
    password: "nested-password-sentinel",
    resetToken: "nested-reset-token-sentinel",
    authToken: "nested-auth-token-sentinel",
    extraNested: "nested-extra-sentinel",
  }],
};

test("public user DTO retains profile and membership fields while dropping untrusted extras", () => {
  const dto = toPublicUserDto(fixture);

  assert.deepEqual(Object.keys(dto).sort(), [
    "avatar", "createdAt", "email", "firstName", "id", "image", "isActive", "isTeamMember",
    "lastName", "locale", "memberOf", "name", "phone", "role", "theme", "updatedAt",
  ].sort());
  assert.deepEqual(dto.memberOf.map((membership) => Object.keys(membership).sort()), [[
    "id", "isActive", "organizationId", "organizationSlug", "role",
  ].sort()]);
  assert.equal(dto.id, fixture.id);
  assert.equal(dto.email, fixture.email);
  assert.equal(dto.firstName, fixture.firstName);
  assert.equal(dto.lastName, fixture.lastName);
  assert.equal(dto.phone, fixture.phone);
  assert.deepEqual(dto.memberOf, [{
    id: "membership-1",
    organizationId: "org-1",
    organizationSlug: "example-org",
    role: "MANAGER",
    isActive: true,
  }]);

  const serialized = JSON.stringify(dto);
  for (const sentinel of [
    "password-sentinel", "reset-token-sentinel", "auth-token-sentinel", "top-level-extra-sentinel",
    "nested-password-sentinel", "nested-reset-token-sentinel", "nested-auth-token-sentinel", "nested-extra-sentinel",
  ]) {
    assert.equal(serialized.includes(sentinel), false, `DTO must not serialize ${sentinel}`);
  }
});

test("public user Prisma projection is organization-bounded and excludes secrets and business hours", () => {
  const select = publicUserSelect("org-1");

  assert.equal("password" in select, false);
  assert.equal("businessHours" in select, false);
  assert.deepEqual(select.memberOf.where, { organizationId: "org-1" });
  assert.deepEqual(Object.keys(select.memberOf.select).sort(), [
    "id", "organizationId", "organizationSlug", "role", "isActive",
  ].sort());
  assert.equal("password" in select.memberOf.select, false);
});
