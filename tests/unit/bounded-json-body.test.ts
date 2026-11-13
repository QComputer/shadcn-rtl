import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
mock.module("@/lib/api-guards", { namedExports: { ApiError } });

let readBoundedJson: typeof import("@/lib/security/bounded-json").readBoundedJson;

async function loadSubject() {
  ({ readBoundedJson } = await import("@/lib/security/bounded-json"));
}

function streamedRequest(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]!);
      else controller.close();
    },
  });
  return new Request("http://localhost/api/demo/test", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

describe("bounded JSON request reader", () => {
  it("parses normal JSON when Content-Length is absent", async () => {
    await loadSubject();
    const request = streamedRequest([bytes('{"itemIds":["one"]}')]);
    assert.deepEqual(await readBoundedJson(request, { maxBytes: 128 }), { itemIds: ["one"] });
  });

  it("rejects actual streamed bytes over the cap without Content-Length", async () => {
    await loadSubject();
    const request = streamedRequest([bytes('{"x":"'), bytes("1234"), bytes('"}')]);
    await assert.rejects(readBoundedJson(request, { maxBytes: 10 }), (error: unknown) =>
      error instanceof ApiError && error.status === 413,
    );
  });

  it("rejects a lying smaller Content-Length based on actual streamed bytes", async () => {
    await loadSubject();
    const request = streamedRequest([bytes('{"x":"123456789"}')], { "content-length": "2" });
    await assert.rejects(readBoundedJson(request, { maxBytes: 10 }), (error: unknown) =>
      error instanceof ApiError && error.status === 413,
    );
  });

  it("rejects an oversized declared Content-Length before reading the stream", async () => {
    await loadSubject();
    let pulls = 0;
    const request = new Request("http://localhost/api/demo/test", {
      method: "POST",
      headers: { "content-length": "11" },
      body: new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(bytes("{}")); } }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pullsBeforeRead = pulls;
    await assert.rejects(readBoundedJson(request, { maxBytes: 10 }), (error: unknown) =>
      error instanceof ApiError && error.status === 413,
    );
    assert.equal(pulls, pullsBeforeRead);
  });

  it("returns a 400 for malformed JSON by default", async () => {
    await loadSubject();
    await assert.rejects(readBoundedJson(streamedRequest([bytes("{")]), { maxBytes: 10 }), (error: unknown) =>
      error instanceof ApiError && error.status === 400,
    );
  });

  it("preserves approve's empty-body behavior and rejects malformed nonempty JSON", async () => {
    await loadSubject();
    const options = { maxBytes: 10, emptyBody: "empty-object" as const };
    assert.deepEqual(await readBoundedJson(new Request("http://localhost/api/demo/test", { method: "POST" }), options), {});
    assert.deepEqual(await readBoundedJson(streamedRequest([bytes("")]), options), {});
    await assert.rejects(readBoundedJson(streamedRequest([bytes("{")]), options), (error: unknown) =>
      error instanceof ApiError && error.status === 400,
    );
  });
});
