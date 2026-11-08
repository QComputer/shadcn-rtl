import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isImageDerivatives,
  renderRetailImageDerivatives,
  resetRetailSharpLoaderForTests,
  setRetailSharpImporterForTests,
} from "@/lib/retail/image-derivatives.server";

function fakeSharpFactory(input: Buffer) {
  return {
    rotate() { return this; },
    resize(options: { width: number }) {
      (this as { _width?: number })._width = options.width;
      return this;
    },
    webp() { return this; },
    async metadata() {
      return { format: "jpeg", width: 2000, height: 1500 };
    },
    async toBuffer() {
      const width = Math.min((this as { _width?: number })._width ?? 1600, 2000);
      const height = Math.max(1, Math.round(width * 0.75));
      const data = Buffer.from(`webp:${input.byteLength}:${width}`);
      return { data, info: { width, height } };
    },
  };
}

describe("retail image derivatives", () => {
  afterEach(() => {
    resetRetailSharpLoaderForTests();
  });

  it("validates stored derivative payloads and rejects unsafe/invalid variants", () => {
    assert.equal(isImageDerivatives({
      version: 1,
      card: [{ url: "/uploads/a.webp", width: 320, height: 240, bytes: 100 }],
      detail: { url: "https://cdn.example.com/d.webp", width: 1600, height: 1200, bytes: 500 },
    }), true);
    assert.equal(isImageDerivatives({ version: 1, card: [] }), false);
    assert.equal(isImageDerivatives({ version: 1, card: [{ url: "//evil/a.webp", width: 320, height: 240, bytes: 100 }] }), false);
    assert.equal(isImageDerivatives({ version: 1, card: [{ url: "/uploads/../a.webp", width: 320, height: 240, bytes: 100 }] }), false);
    assert.equal(isImageDerivatives({ version: 1, card: [{ url: "/uploads/a.webp", width: 961, height: 240, bytes: 100 }] }), false);
  });

  it("loads sharp via runtime import and renders card/detail derivatives", async () => {
    setRetailSharpImporterForTests(async () => ({ default: fakeSharpFactory as never }));
    const result = await renderRetailImageDerivatives(Buffer.from("original-jpeg"));
    assert.deepEqual(result.card.map((v) => v.width), [320, 640, 960]);
    assert.ok(result.card.every((v) => v.bytes > 0 && v.url === ""));
    assert.equal(result.detail?.width, 1600);
  });

  it("surfaces a clear error when sharp is unavailable", async () => {
    setRetailSharpImporterForTests(async () => { throw new Error("Cannot find module 'sharp'"); });
    await assert.rejects(
      () => renderRetailImageDerivatives(Buffer.from("x")),
      /Retail image processing requires the optional 'sharp' dependency.*Cannot find module 'sharp'/,
    );
  });

  it("retries after a missing-sharp failure (no stale rejected cache)", async () => {
    let calls = 0;
    setRetailSharpImporterForTests(async () => {
      calls += 1;
      if (calls === 1) throw new Error("missing");
      return { default: fakeSharpFactory as never };
    });
    await assert.rejects(() => renderRetailImageDerivatives(Buffer.from("x")));
    const result = await renderRetailImageDerivatives(Buffer.from("x"));
    assert.equal(result.card.length, 3);
    assert.equal(calls, 2);
  });
});
