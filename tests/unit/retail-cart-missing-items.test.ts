import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

class TestApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

let cartItem: Record<string, unknown> | null;
let updateCalls: number;
let deleteCalls: number;

mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });
mock.module("@/lib/db", { namedExports: { prisma: {
  shopCartItem: {
    findUnique: async () => cartItem,
    update: async () => { updateCalls += 1; },
    delete: async () => { deleteCalls += 1; },
  },
} } });
mock.module("next/cache", { namedExports: { revalidatePath: () => undefined } });
mock.module("@/lib/organization-public-home", { namedExports: { activePublicBusinessCapabilities: () => [] } });
mock.module("@/lib/money", { namedExports: { toMoneyDecimal: (value: unknown) => value, toMoneyNumber: (value: unknown) => Number(value) } });
mock.module("@/lib/i18n", { namedExports: { supportedLocales: ["fa", "en", "ar"] } });
mock.module("@/lib/custom-domain-routing", { namedExports: { buildOrganizationPublicPath: () => "/shop" } });
mock.module("@/lib/retail/product-galleries", { namedExports: { orderedImages: () => [], readGallerySettings: () => null } });

let cartService: typeof import("@/lib/services/cart.service").cartService;
before(async () => {
  ({ cartService } = await import("@/lib/services/cart.service"));
});

test("missing Retail cart lines return 404 without attempting update or delete", async () => {
  cartItem = null;
  updateCalls = 0;
  deleteCalls = 0;

  await assert.rejects(
    () => cartService.updateItemQuantity("missing-item", { quantity: 2 }, "customer-a", null, "store-a"),
    (error: unknown) => error instanceof TestApiError && error.status === 404 && error.message === "Cart item not found.",
  );
  await assert.rejects(
    () => cartService.removeItem("missing-item", "customer-a", null, "store-a"),
    (error: unknown) => error instanceof TestApiError && error.status === 404 && error.message === "Cart item not found.",
  );

  assert.equal(updateCalls, 0);
  assert.equal(deleteCalls, 0);
});

test("existing cart lines still enforce owner checks before mutation", async () => {
  cartItem = { cart: { customerId: "customer-b", sessionId: null } };
  updateCalls = 0;
  deleteCalls = 0;

  await assert.rejects(() => cartService.updateItemQuantity("foreign-item", { quantity: 2 }, "customer-a", null, "store-a"), /Unauthorized/);
  await assert.rejects(() => cartService.removeItem("foreign-item", "customer-a", null, "store-a"), /Unauthorized/);

  assert.equal(updateCalls, 0);
  assert.equal(deleteCalls, 0);
});
