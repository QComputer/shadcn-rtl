import assert from "node:assert/strict";
import { test } from "node:test";
import { guestClaimHttpEnabled, parseGuestClaimInput } from "../../lib/customer-auth/guest-claim-http.contract";
const request = { action: "REQUEST", kind: "ORDER", recordId: "record-1", claimConfirmed: true };
test("all three flags must be explicitly enabled", () => { assert.equal(guestClaimHttpEnabled({}), false); assert.equal(guestClaimHttpEnabled({ CUSTOMER_GUEST_CLAIM_ENABLED: "1", CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED: "1" }), false); assert.equal(guestClaimHttpEnabled({ CUSTOMER_GUEST_CLAIM_ENABLED: "1", CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED: "1", CUSTOMER_PHONE_AUTH_ENABLED: "1" }), true); });
test("discovery cannot accept phone, browser or tenant override", () => { assert.deepEqual(parseGuestClaimInput({action:"LIST",kind:"ORDER"}), {action:"LIST",kind:"ORDER"}); for (const field of ["phone","guestSessionId","organizationId","userId","origin"]) assert.equal(parseGuestClaimInput({action:"LIST",kind:"ORDER",[field]:"x"}),null); });
test("request needs explicit true and exact record", () => { assert.deepEqual(parseGuestClaimInput(request),request); for(const flag of [false,"true",undefined]) assert.equal(parseGuestClaimInput({...request,claimConfirmed:flag}),null); assert.equal(parseGuestClaimInput({...request,recordId:"../../x"}),null); });
test("claim binds exact challenge and normalizes OTP digits", () => { const input={...request,action:"CLAIM",challengeId:"12345678-1234-4123-8123-123456789abc",otp:"۱۲۳۴"}; assert.deepEqual(parseGuestClaimInput(input),{...input,otp:"1234"}); assert.equal(parseGuestClaimInput({...input,challengeId:"invalid"}),null); assert.equal(parseGuestClaimInput({...input,otp:"12345"}),null); });
test("unknown fields, operations and record types fail closed", () => { for (const value of [null,[],{...request,phone:"09120000000"},{...request,kind:"UNKNOWN"},{...request,action:"AUTO"},{...request,otp:"1234"}]) assert.equal(parseGuestClaimInput(value),null); });

test("hotel claims require an explicit record and consent", () => { const hotel = {...request,kind:"HOTEL"}; assert.deepEqual(parseGuestClaimInput(hotel),hotel); assert.equal(parseGuestClaimInput({...hotel,claimConfirmed:false}),null); });

test("hotel discovery accepts only one literal bounded reference", () => { assert.deepEqual(parseGuestClaimInput({action:"LIST",kind:"HOTEL",reference:"H-123"}),{action:"LIST",kind:"HOTEL",reference:"H-123"}); for(const reference of [undefined,"","%","x".repeat(129)]) assert.equal(parseGuestClaimInput({action:"LIST",kind:"HOTEL",reference}),null); assert.equal(parseGuestClaimInput({action:"LIST",kind:"HOTEL",reference:"H-123",phone:"x"}),null); });

test("recovery credential is limited to hotel requests and canonical 256-bit values", () => {
  const recoveryCredential = Buffer.alloc(32, 7).toString("base64url");
  const lookup = { action: "LIST", kind: "HOTEL", reference: "H-123", recoveryCredential };
  assert.deepEqual(parseGuestClaimInput(lookup), lookup);
  assert.equal(parseGuestClaimInput({ ...lookup, recoveryCredential: "bad" }), null);
  assert.equal(parseGuestClaimInput({ action: "LIST", kind: "ORDER", recoveryCredential }), null);
  assert.equal(parseGuestClaimInput({ ...lookup, organizationId: "other" }), null);
});
