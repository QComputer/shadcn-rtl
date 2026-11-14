import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { businessHoursSchema } from "@/lib/validators";

class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });

let readBoundedJson: typeof import("@/lib/security/bounded-json").readBoundedJson;
before(async () => {
  ({ readBoundedJson } = await import("@/lib/security/bounded-json"));
});

const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

function businessHour(day: (typeof weekdays)[number]) {
  return { day, openTime: "09:00", closeTime: "17:00" };
}

describe("business hours request schema", () => {
  it("accepts the seven-day dashboard contract and retains the open default", () => {
    const result = businessHoursSchema.parse(weekdays.map(businessHour));

    assert.equal(result.length, 7);
    assert.ok(result.every((item) => item.isOpen));
  });

  it("rejects more than seven days", () => {
    const result = businessHoursSchema.safeParse([
      ...weekdays.map(businessHour),
      businessHour("MONDAY"),
    ]);

    assert.equal(result.success, false);
  });

  it("continues to allow an empty array for clearing stored hours", () => {
    assert.deepEqual(businessHoursSchema.parse([]), []);
  });

  it("uses the shared 64 KiB cap on actual request bytes", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64 * 1024 + 1));
        controller.close();
      },
    });
    const request = new Request("https://app.example/api/business-hours", {
      method: "PUT",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await assert.rejects(readBoundedJson(request), (error: unknown) =>
      error instanceof TestApiError && error.status === 413,
    );
  });
});
