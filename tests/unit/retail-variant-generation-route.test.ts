import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";
import { variantGenerationSchema } from "@/lib/retail/merchant-catalog.server";

const calls: Array<{ action: string; input: unknown }> = [];
let originChecks = 0;
mock.module(pathToFileURL(resolve("lib/retail/merchant-context.server.ts")).href, { namedExports: {
  requireRetailMerchantContext: async () => ({ context: { organizationId: "fixture-store" }, session: { user: { id: "fixture-manager" } } }),
  assertRetailMutationOrigin: () => { originChecks++; },
} });
mock.module(pathToFileURL(resolve("lib/retail/merchant-catalog.server.ts")).href, { namedExports: {
  variantGenerationSchema,
  previewRetailVariantGeneration: async (_context: unknown, _id: string, input: unknown) => { calls.push({ action: "preview", input }); return { toAdd: 2, existing: 0, canCreate: [], errors: [] }; },
  generateRetailVariants: async (_context: unknown, _actor: string, _id: string, input: unknown) => { calls.push({ action: "generate", input }); return { added: 2, skipped: 0 }; },
} });
let POST: typeof import("../../app/api/dashboard/retail/catalog/[productId]/variants/route").POST;
before(async () => { ({ POST } = await import("../../app/api/dashboard/retail/catalog/[productId]/variants/route")); });
const values = { sizeDefinitionId: "size", sizeMode: "RANGE", sizeStart: 38.5, sizeEnd: 39, sizeStep: 0.5 };
function request(body: unknown) {
  return new NextRequest("https://fixture.test/api/dashboard/retail/catalog/product/variants", { method: "POST", headers: { "content-type": "application/json", origin: "https://fixture.test" }, body: JSON.stringify(body) });
}
test("preview accepts action metadata while retaining strict generation input validation", async () => {
  calls.length = 0; originChecks = 0;
  const response = await POST(request({ ...values, action: "preview" }), { params: Promise.resolve({ productId: "product" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ action: "preview", input: values }]);
  assert.equal(originChecks, 0);
  const invalid = await POST(request({ ...values, action: "preview", unknownField: true }), { params: Promise.resolve({ productId: "product" }) });
  assert.equal(invalid.status, 400);
  assert.equal(calls.length, 1);
});
test("generation checks mutation origin and passes canonical values to the service", async () => {
  calls.length = 0; originChecks = 0;
  const response = await POST(request({ ...values, action: "generate" }), { params: Promise.resolve({ productId: "product" }) });
  assert.equal(response.status, 200);
  assert.equal(originChecks, 1);
  assert.deepEqual(calls, [{ action: "generate", input: values }]);
  assert.deepEqual(await response.json(), { result: { added: 2, skipped: 0 } });
});
