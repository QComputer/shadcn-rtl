import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

test("public availability and quote handlers fail closed without publication approval", async () => {
  const availability = await import("../../app/api/hotel/v1/availability/search/route");
  const quotes = await import("../../app/api/hotel/v1/quotes/route");
  const request = new NextRequest("https://hotel.example/api", { method: "POST", body: "{}" });
  assert.equal((await availability.POST(request)).status, 503);
  assert.equal((await quotes.POST(request)).status, 503);
});
