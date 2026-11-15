import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("hotel receipts remain private and scoped to the owning tenant", async () => {
  const original = process.env.MEDIA_STORAGE_ROOT;
  const root = await mkdtemp(path.join(os.tmpdir(), "hotel-receipt-test-"));
  process.env.MEDIA_STORAGE_ROOT = root;
  try {
    const { listStaleHotelPaymentReceipts, storeHotelPaymentReceipt, readHotelPaymentReceipt } = await import("../../lib/hotel/offline-payments/receipt-storage.server");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const key = await storeHotelPaymentReceipt("tenant_a", png, "image/png");
    await storeHotelPaymentReceipt("tenant_a", png, "image/png");
    const otherTenantKey = await storeHotelPaymentReceipt("tenant_b", png, "image/png");
    assert.match(key, /^[0-9a-f-]{36}\.png$/);
    assert.deepEqual((await readHotelPaymentReceipt("tenant_a", key)).buffer, png);
    await assert.rejects(readHotelPaymentReceipt("tenant_b", key));
    const cutoff = new Date(Date.now() + 60_000);
    assert.equal((await listStaleHotelPaymentReceipts({ organizationId: "tenant_a", olderThan: cutoff, limit: 1 })).length, 1, "old receipt scans are bounded by the caller-supplied limit");
    const tenantAKeys = await listStaleHotelPaymentReceipts({ organizationId: "tenant_a", olderThan: cutoff, limit: 10 });
    assert.equal(tenantAKeys.length, 2);
    assert.ok(!tenantAKeys.includes(otherTenantKey), "reconciliation cannot enumerate another tenant's files");
    assert.deepEqual(await listStaleHotelPaymentReceipts({ organizationId: "tenant_b", olderThan: cutoff, limit: 10 }), [otherTenantKey]);
    await assert.rejects(readHotelPaymentReceipt("tenant_a", "../receipt.png"));
    await assert.rejects(readHotelPaymentReceipt("tenant_a", "not-a-uuid.png"));
    await assert.rejects(readHotelPaymentReceipt("tenant_a", "11111111-1111-4111-8111-111111111111.gif"));
    await assert.rejects(storeHotelPaymentReceipt("tenant_a", Buffer.from("not an image"), "image/png"));
    await assert.rejects(storeHotelPaymentReceipt("tenant_a", Buffer.from("\x89PNG\r\n\x1a\n<script>alert(1)</script>"), "image/jpeg"));
    await assert.rejects(storeHotelPaymentReceipt("tenant_a", Buffer.alloc(0), "image/png"));
  } finally {
    if (original === undefined) delete process.env.MEDIA_STORAGE_ROOT;
    else process.env.MEDIA_STORAGE_ROOT = original;
    await rm(root, { recursive: true, force: true });
  }
});
