import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { parseProgressiveCredentials, parseProgressiveRequest, progressiveCustomerEnrollmentEnabled } from "../../lib/customer-auth/progressive-contract";
import { isCustomDomainApplicationPath, resolveOperationalAppRoute } from "../../lib/custom-domain-routing";
const signIn = { phone: "۰۹۱۲۳۴۵۶۷۸۹", organization: "fixture", purpose: "ACCOUNT_SIGN_IN" };
const enroll = { ...signIn, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: true };
const challengeId = randomUUID();
test("gate accepts only the exact enabled setting", () => {
  for (const value of ["", "0", "true", "yes", " 1", "01"]) assert.equal(progressiveCustomerEnrollmentEnabled(value), false);
  assert.equal(progressiveCustomerEnrollmentEnabled("1"), true);
});
test("normalizes Persian mobile and preserves explicit sign-in intent", () => {
  assert.deepEqual(parseProgressiveRequest(signIn), { ...signIn, phone: "09123456789" });
});
test("enrollment requires boolean affirmative consent at issuance", () => {
  assert.ok(parseProgressiveRequest(enroll));
  for (const enrollmentConfirmed of [undefined, false, "true", 1, null]) assert.equal(parseProgressiveRequest({ ...enroll, enrollmentConfirmed }), null);
});
test("rejects proof, legacy, extras, invalid tenant and invalid mobile", () => {
  for (const input of [{ ...signIn, purpose: "PHONE_PROOF" }, { ...signIn, purpose: "LEGACY" }, { ...signIn, claim: true }, { ...signIn, organization: "" }, { ...signIn, phone: "123" }, { ...signIn, enrollmentConfirmed: true }, null, []]) assert.equal(parseProgressiveRequest(input), null);
});
test("callback requires purpose, opaque challenge and valid localized OTP without a token", () => {
  const input = { ...signIn, challengeId, otp: "۱۲۳۴" };
  assert.deepEqual(parseProgressiveCredentials(input), { ...signIn, phone: "09123456789", challengeId, otp: "1234" });
  for (const candidate of [{ ...input, challengeId: "bad" }, { ...input, otp: "12345" }, { ...input, token: "legacy" }, { ...input, purpose: "PHONE_PROOF" }, { ...input, purpose: undefined }]) assert.equal(parseProgressiveCredentials(candidate), null);
});
test("callback enrollment requires separately affirmative form field", () => {
  const input = { ...enroll, challengeId, otp: "1234" };
  assert.ok(parseProgressiveCredentials({ ...input, enrollmentConfirmed: "true" }));
  for (const enrollmentConfirmed of [true, false, "false", undefined, "1"]) assert.equal(parseProgressiveCredentials({ ...input, enrollmentConfirmed }), null);
});

test("phone login is an exact application route on localized and unlocalized tenant domains", () => {
  for (const path of ["/login/phone", "/fa/login/phone", "/en/login/phone", "/ar/login/phone"]) assert.equal(isCustomDomainApplicationPath(path), true, path);
  for (const path of ["/login/phone/extra", "/fa/login/phone/extra", "/login/phones", "/shop/login/phone", "/login/arbitrary"]) assert.equal(isCustomDomainApplicationPath(path), false, path);
});
test("operational app routes keep phone login on its exact localized authentication path", () => {
  for (const [path, locale] of [["/login/phone", "fa"], ["/fa/login/phone", "fa"], ["/en/login/phone", "en"], ["/ar/login/phone", "ar"]]) {
    assert.deepEqual(resolveOperationalAppRoute(path, "fixture"), { locale, internalPathname: `/${locale}/login/phone`, surface: "LOGIN" });
  }
  assert.deepEqual(resolveOperationalAppRoute("/en/login", "fixture"), { locale: "en", internalPathname: "/en/login", surface: "LOGIN" });
  assert.equal(resolveOperationalAppRoute("/login/phone/extra", "fixture"), null);
  assert.equal(resolveOperationalAppRoute("/login/phone", "../invalid"), null);
});
