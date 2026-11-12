import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizedProductRouteTraceId, productRouteTraceId } from "@/lib/product-route-diagnostics";

const traceId = "7f2c99ba-7b9a-4a3d-9fd3-62e163c9b041";
const key = "test-only-product-route-diagnostic-key-32-chars";

describe("product route diagnostic gate", () => {
  it("requires an explicit long key, matching request key, valid trace ID, and product path", () => {
    const headers = new Headers({
      "x-bazar-product-route-diagnostic-key": key,
      "x-bazar-product-route-trace-id": traceId,
    });
    const env = { BAZARBAAZ_PRODUCT_ROUTE_DIAGNOSTIC_KEY: key };

    assert.equal(authorizedProductRouteTraceId(headers, "/shop/product/کفش", env), traceId);
    assert.equal(authorizedProductRouteTraceId(headers, "/shop", env), null);
    assert.equal(authorizedProductRouteTraceId(new Headers({ ...Object.fromEntries(headers), "x-bazar-product-route-diagnostic-key": "wrong" }), "/shop/product/shoe", env), null);
    assert.equal(authorizedProductRouteTraceId(headers, "/shop/product/shoe", {}), null);
    assert.equal(authorizedProductRouteTraceId(new Headers({ ...Object.fromEntries(headers), "x-bazar-product-route-trace-id": "bad" }), "/shop/product/shoe", env), null);
  });

  it("accepts only UUID trace IDs from the proxy-forwarded header", () => {
    assert.equal(productRouteTraceId(new Headers({ "x-bazar-product-route-trace-id": traceId })), traceId);
    assert.equal(productRouteTraceId(new Headers({ "x-bazar-product-route-trace-id": "attacker-value" })), null);
    assert.equal(productRouteTraceId(new Headers()), null);
  });
});
