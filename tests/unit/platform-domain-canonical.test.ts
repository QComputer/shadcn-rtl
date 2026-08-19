import { register } from "node:module";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

register(new URL("./loader.mjs", import.meta.url));

let ApiError: any;
let validateRawDomain: any;
let isPlatformHost: any;
let CANONICAL_PLATFORM_HOST: string;
let getPlatformCanonicalRedirectTarget: any;

before(async () => {
  ({ ApiError } = await import("@/lib/api-guards"));
  ({ isPlatformHost, getPlatformCanonicalRedirectTarget, CANONICAL_PLATFORM_HOST } = await import("@/lib/custom-domain-routing"));
  ({ validateRawDomain } = await import("@/lib/domains/domain-normalization.server"));
});

describe("platform host recognition: bazarbaaz.ir", () => {
  it("A: recognizes the new canonical platform host (and www variant) as platform hosts", () => {
    assert.equal(isPlatformHost("bazarbaaz.ir"), true);
    assert.equal(isPlatformHost("www.bazarbaaz.ir"), true);
    assert.equal(isPlatformHost("BAZARBAAZ.IR"), true);
    assert.equal(isPlatformHost("bazarbaaz.ir:443"), true);
    assert.equal(isPlatformHost("bazarbaaz.ir:9600"), true);
    assert.equal(isPlatformHost("www.bazarbaaz.ir:9600"), true);
  });

  it("B: recognizes bazar-baz.ir legacy platform hosts", () => {
    assert.equal(isPlatformHost("bazar-baz.ir"), true);
    assert.equal(isPlatformHost("www.bazar-baz.ir"), true);
  });

  it("C: does not treat tenant custom domains as platform hosts", () => {
    assert.equal(isPlatformHost("sicilyfastfood.ir"), false);
    assert.equal(isPlatformHost("sicilyfastfood.lvh.me"), false);
    assert.equal(isPlatformHost("shop.example.ir"), false);
  });

  it("D: treats unknown hosts as non-platform hosts", () => {
    assert.equal(isPlatformHost("unknown.test"), false);
    assert.equal(isPlatformHost("shop.example.ir"), false);
  });
});

describe("platform host is reserved (cannot be a tenant domain)", () => {
  it("rejects bazarbaaz.ir and its www variant as custom domains", () => {
    assert.throws(
      () => validateRawDomain("bazarbaaz.ir"),
      (err: any) => err instanceof ApiError && err.status === 400,
    );
    assert.throws(
      () => validateRawDomain("www.bazarbaaz.ir"),
      (err: any) => err instanceof ApiError && err.status === 400,
    );
  });
});

describe("canonical platform redirect (bazarbaaz.ir migration)", () => {
  it("exposes the canonical apex host", () => {
    assert.equal(CANONICAL_PLATFORM_HOST, "bazarbaaz.ir");
  });

  it("returns null for the canonical apex host (no redirect, no loop)", () => {
    assert.equal(getPlatformCanonicalRedirectTarget("bazarbaaz.ir"), null);
    assert.equal(getPlatformCanonicalRedirectTarget("bazarbaaz.ir:443"), null);
    assert.equal(getPlatformCanonicalRedirectTarget("bazarbaaz.ir:3000"), null);
    assert.equal(getPlatformCanonicalRedirectTarget("bazarbaaz.ir:9600"), null);
  });

  it("B: redirects the www variant to the canonical apex", () => {
    assert.equal(
      getPlatformCanonicalRedirectTarget("www.bazarbaaz.ir"),
      "https://bazarbaaz.ir",
    );
    assert.equal(
      getPlatformCanonicalRedirectTarget("WWW.BAZARBAAZ.IR"),
      "https://bazarbaaz.ir",
    );
    assert.equal(
      getPlatformCanonicalRedirectTarget("www.bazarbaaz.ir:443"),
      "https://bazarbaaz.ir",
    );
    assert.equal(
      getPlatformCanonicalRedirectTarget("www.bazarbaaz.ir:9600"),
      "https://bazarbaaz.ir",
    );
  });

  it("C: redirects legacy bazar-baz.ir hosts to the canonical apex", () => {
    assert.equal(
      getPlatformCanonicalRedirectTarget("bazar-baz.ir"),
      "https://bazarbaaz.ir",
    );
    assert.equal(
      getPlatformCanonicalRedirectTarget("www.bazar-baz.ir"),
      "https://bazarbaaz.ir",
    );
    assert.equal(
      getPlatformCanonicalRedirectTarget("bazar-baz.ir:443"),
      "https://bazarbaaz.ir",
    );
  });

  it("does not redirect tenant or unknown custom hosts", () => {
    assert.equal(getPlatformCanonicalRedirectTarget("sicilyfastfood.ir"), null);
    assert.equal(getPlatformCanonicalRedirectTarget("unknown.test"), null);
  });

  it("returns null for empty or missing hosts", () => {
    assert.equal(getPlatformCanonicalRedirectTarget(null), null);
    assert.equal(getPlatformCanonicalRedirectTarget(undefined), null);
    assert.equal(getPlatformCanonicalRedirectTarget(""), null);
  });
});
