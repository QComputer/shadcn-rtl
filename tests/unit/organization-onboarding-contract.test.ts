import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bootstrapHotelOrganizationSchema,
  issueBoundInvitationSchema,
  onboardingIdempotencyKeySchema,
  redeemOrganizationInvitationSchema,
  revokeOrganizationInvitationSchema,
} from "@/lib/organization-onboarding/contract";

const cuid = "cabcdefghijklmnopqrstuvwx";

test("Hotel bootstrap contract is strict and defaults locale to Persian", () => {
  const result = bootstrapHotelOrganizationSchema.parse({
    name: "Damoon Hotel",
    slug: "damoon-hotel",
    property: { name: "Damoon Main", slug: "main" },
  });
  assert.equal(result.locale, "fa");
  assert.throws(() => bootstrapHotelOrganizationSchema.parse({
    name: "Damoon Hotel",
    slug: "damoon-hotel",
    property: { name: "Damoon Main", slug: "main" },
    organizationId: cuid,
  }));
  assert.throws(() => bootstrapHotelOrganizationSchema.parse({
    name: "Damoon Hotel",
    slug: "damoon-hotel",
    locale: "de",
    property: { name: "Damoon Main", slug: "main" },
  }));
});

test("bound invitation normalizes the recipient email and constrains role and lifetime", () => {
  const result = issueBoundInvitationSchema.parse({
    organizationId: cuid,
    recipientUserId: "cbbbbbbbbbbbbbbbbbbbbbbbb",
    recipientEmail: "  Owner@Example.COM ",
    recipientUsername: "hotel-owner",
    invitedRole: "ADMIN",
  });
  assert.equal(result.recipientEmail, "owner@example.com");
  assert.equal(result.ttlHours, 24);
  assert.throws(() => issueBoundInvitationSchema.parse({
    organizationId: cuid,
    recipientUserId: "cbbbbbbbbbbbbbbbbbbbbbbbb",
    recipientEmail: "owner@example.com",
    recipientUsername: "hotel-owner",
    invitedRole: "SUPER_ADMIN",
  }));
  assert.throws(() => issueBoundInvitationSchema.parse({
    organizationId: cuid,
    recipientUserId: "cbbbbbbbbbbbbbbbbbbbbbbbb",
    recipientEmail: "owner@example.com",
    recipientUsername: "hotel-owner",
    invitedRole: "ADMIN",
    ttlHours: 73,
  }));
  assert.throws(() => issueBoundInvitationSchema.parse({
    organizationId: cuid,
    recipientUserId: "cbbbbbbbbbbbbbbbbbbbbbbbb",
    recipientEmail: "owner@example.com",
    recipientUsername: "hotel-owner",
    invitedRole: "ADMIN",
    userId: "cspoofed",
  }));
});

test("invitation redemption accepts only a 43-character base64url token", () => {
  const token = "A".repeat(43);
  assert.deepEqual(redeemOrganizationInvitationSchema.parse({ token }), { token });
  assert.throws(() => redeemOrganizationInvitationSchema.parse({ token: `${token}=` }));
  assert.throws(() => redeemOrganizationInvitationSchema.parse({ token, userId: cuid }));
});

test("revoke invitation accepts only its identifier", () => {
  assert.deepEqual(revokeOrganizationInvitationSchema.parse({ invitationId: cuid }), { invitationId: cuid });
  assert.throws(() => revokeOrganizationInvitationSchema.parse({ invitationId: cuid, organizationId: cuid }));
});

test("onboarding idempotency keys are ASCII and bounded from 8 through 128 characters", () => {
  assert.equal(onboardingIdempotencyKeySchema.safeParse("key-1234").success, true);
  assert.equal(onboardingIdempotencyKeySchema.safeParse("x".repeat(128)).success, true);
  assert.equal(onboardingIdempotencyKeySchema.safeParse("short").success, false);
  assert.equal(onboardingIdempotencyKeySchema.safeParse("x".repeat(129)).success, false);
  assert.equal(onboardingIdempotencyKeySchema.safeParse("clé-1234").success, false);
});
