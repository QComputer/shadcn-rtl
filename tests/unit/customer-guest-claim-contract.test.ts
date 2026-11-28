import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { guestClaimBinding, type GuestClaimScope } from "../../lib/customer-auth/guest-claim.contract";
import { guestOrderScope } from "../../lib/retail/guest-order-scope";
import { createHash } from "node:crypto";

const secret = "synthetic-guest-claim-contract-secret-32";
const scope: GuestClaimScope = { kind: "ORDER", recordId: "order-a", userId: "user-a", sessionId: "session-a",
  organizationId: "org-a", origin: "https://a.example.test", guestSessionId: randomUUID(), phone: "09123456789", claimConfirmed: true };

test("record claim binding is deterministic and normalizes phone formatting", () => {
  const hash = guestClaimBinding(scope, secret);
  assert.match(hash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(hash, guestClaimBinding({ ...scope, phone: "+98 912-345-6789" }, secret));
  assert.notEqual(hash, guestClaimBinding(scope, `${secret}-other`));
});
test("binding isolates every authority and target dimension", () => {
  const hash = guestClaimBinding(scope, secret);
  const changes: Partial<GuestClaimScope>[] = [{ kind: "APPOINTMENT" }, { recordId: "other" }, { userId: "other" },
    { sessionId: "other" }, { organizationId: "other" }, { origin: "https://b.example.test" }, { guestSessionId: randomUUID() }, { phone: "09123456780" }];
  for (const change of changes) assert.notEqual(guestClaimBinding({ ...scope, ...change }, secret), hash);
});
test("invalid or missing consent, browser, phone and origin fail closed", () => {
  const invalid = [ { ...scope, claimConfirmed: false }, { ...scope, guestSessionId: "guessed" }, { ...scope, phone: "123" },
    { ...scope, recordId: "../other" }, { ...scope, origin: "https://a.example.test/path" }, { ...scope, origin: "not-an-origin" }, { ...scope, kind: "HOTEL" } ];
  for (const value of invalid) assert.equal(guestClaimBinding(value as GuestClaimScope, secret), null);
  assert.equal(guestClaimBinding(scope, "short"), null);
});
test("extracted guest order scope is byte-compatible with accepted G2", () => {
  const expected = `retail-order:v1:${createHash("sha256").update(JSON.stringify(["shop-a", scope.guestSessionId])).digest("hex")}:`;
  assert.equal(guestOrderScope("shop-a", scope.guestSessionId), expected);
  assert.notEqual(guestOrderScope("shop-b", scope.guestSessionId), expected);
});

test("hotel binding requires canonical original browser proof and binds the record", () => {
  const token = Buffer.alloc(32, 9).toString("base64url");
  const hotel: GuestClaimScope = { ...scope, kind: "HOTEL", guestSessionId: token };
  const binding = guestClaimBinding(hotel, secret);
  assert.match(binding ?? "", /^[a-f0-9]{64}$/);
  assert.notEqual(guestClaimBinding({ ...hotel, recordId: "another" }, secret), binding);
  assert.notEqual(guestClaimBinding({ ...hotel, guestSessionId: Buffer.alloc(32, 8).toString("base64url") }, secret), binding);
  assert.equal(guestClaimBinding({ ...hotel, guestSessionId: "invalid" }, secret), null);
  assert.equal(guestClaimBinding({ ...hotel, claimConfirmed: false } as unknown as GuestClaimScope, secret), null);
});
