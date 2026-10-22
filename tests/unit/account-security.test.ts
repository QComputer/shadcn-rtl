import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { credentialBinding, sameCredentialBinding } from "@/lib/security/credential-binding";

test("credential binding is server-keyed, user-scoped and rejects tampering", () => {
  const secret = randomBytes(32).toString("hex");
  const value = credentialBinding("user-a", "synthetic-hash-a", secret);
  assert.ok(sameCredentialBinding(value, value));
  for (const other of ["", "x".repeat(64), null, value + "0", credentialBinding("user-b", "synthetic-hash-a", secret), credentialBinding("user-a", "synthetic-hash-b", secret)]) {
    assert.equal(sameCredentialBinding(other, value), false);
  }
  assert.equal(value.includes("synthetic"), false);
  assert.throws(() => credentialBinding("user-a", "synthetic", ""));
});

test("unconfigured recovery is explicit, non-enumerating, same-origin and sends nothing", async () => {
  process.env.DATABASE_URL ??= "postgresql://unit.invalid/unused";
  const { GET, POST, PUT } = await import("@/app/api/auth/recovery/route");
  assert.equal((await GET().json()).available, false);
  const response = async (identifier: string, origin = "https://app.example") => POST(new NextRequest("https://app.example/api/auth/recovery", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ identifier }),
  }));
  const known = await response("merchant"), absent = await response("absent-customer");
  assert.equal(known.status, 503); assert.equal(absent.status, 503); assert.deepEqual(await known.json(), await absent.json());
  assert.equal((await response("merchant", "https://attacker.example")).status, 403);
  const consume = await PUT(new NextRequest("https://app.example/api/auth/recovery", { method: "PUT", headers: { origin: "https://app.example" }, body: "{}" }));
  assert.equal(consume.status, 503);
});
