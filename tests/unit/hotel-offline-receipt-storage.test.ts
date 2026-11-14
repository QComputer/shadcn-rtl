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
    const { storeHotelPaymentReceipt, readHotelPaymentReceipt } = await import("../../lib/hotel/offline-payments/receipt-storage.server");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const key = await storeHotelPaymentReceipt("tenant_a", png, "image/png");
    assert.match(key, /^[0-9a-f-]{36}\.png$/);
    assert.deepEqual((await readHotelPaymentReceipt("tenant_a", key)).buffer, png);
    await assert.rejects(readHotelPaymentReceipt("tenant_b", key));
    await assert.rejects(readHotelPaymentReceipt("tenant_a", "../receipt.png"));
    await assert.rejects(storeHotelPaymentReceipt("tenant_a", Buffer.from("not an image"), "image/png"));
  } finally {
    if (original === undefined) delete process.env.MEDIA_STORAGE_ROOT;
    else process.env.MEDIA_STORAGE_ROOT = original;
    await rm(root, { recursive: true, force: true });
  }
});
