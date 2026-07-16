import { readFileSync } from "node:fs";
import { register } from "node:module";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOpenApiFingerprint,
  verifyPinnedRenderContractEvidence,
} from "@/lib/ai-media/render-contract-verification";
import { AI_MEDIA_PINNED_RENDER_CONTRACT } from "@/lib/ai-media/pinned-render-contract";

register(new URL("./loader.mjs", import.meta.url));

function sampleOpenApi() {
  return {
    openapi: "3.1.0",
    info: { title: "AI Media Service", version: "0.1.0" },
    paths: {
      "/health": { get: { responses: { "200": { description: "OK" } } } },
      "/ready": { get: { responses: { "200": { description: "OK" } } } },
    },
    components: {
      schemas: {
        Health: { type: "object" },
        Ready: { type: "object" },
      },
    },
  };
}

function readyBody(extra: Record<string, unknown> = {}) {
  return {
    status: "ready",
    provider: "MOCK",
    database: { ok: true },
    cuda_required: false,
    worker: { gpu_status: "offline" },
    ...extra,
  };
}

function verify(overrides: Record<string, unknown> = {}) {
  const openApiJson = sampleOpenApi();
  return verifyPinnedRenderContractEvidence({
    deployedUrl: "https://bazar-baz-ai-media-service.onrender.com",
    healthStatus: 200,
    healthBody: { status: "ok" },
    readyStatus: 200,
    readyBody: readyBody(),
    openApiStatus: 200,
    openApiJson,
    expectedFingerprint: computeOpenApiFingerprint(openApiJson),
    expectedPathCount: 2,
    expectedSchemaCount: 2,
    expectedProvider: "MOCK",
    ...overrides,
  });
}

describe("AI media pinned Render contract read-only verification", () => {
  it("matches ai-media-service canonical sorted JSON fingerprint algorithm", () => {
    const openApiJson = {
      openapi: "3.1.0",
      info: {
        title: "Parity Test",
        version: "1.0.0",
      },
      paths: {
        "/z": {
          get: {
            summary: "Z",
          },
        },
      },
      components: {
        schemas: {
          B: {
            type: "string",
          },
          A: {
            type: "integer",
          },
        },
      },
    };

    assert.equal(
      computeOpenApiFingerprint(openApiJson),
      "b4baedaaf1f149d0f85d0efa37c17e5fafd1c627ed769c60594acdf254f74b08",
    );
  });

  it("preserves FastAPI integer-valued float schema constraints for deployed parity", () => {
    const openApiJson = {
      openapi: "3.1.0",
      info: { title: "Float Parity", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Request: {
            type: "object",
            properties: {
              count: {
                type: "number",
                minimum: 1,
                maximum: 6,
              },
            },
          },
        },
      },
    };

    assert.equal(
      computeOpenApiFingerprint(openApiJson),
      "030bcde42ba80911e26f3e853da3520783e5a3e955041142b0d165e49c570661",
    );
  });

  it("pins the known ai-media-service expected fingerprint", () => {
    assert.equal(
      AI_MEDIA_PINNED_RENDER_CONTRACT.openApiFingerprintSha256,
      "8bed184dd79980beacc553308652a44d99590c9705b7d37ab9418f4f83868f91",
    );
  });

  it("matching OpenAPI fingerprint passes", () => {
    const result = verify();
    assert.equal(result.ok, true);
    assert.equal(result.safeSummary.pathCount, 2);
    assert.equal(result.safeSummary.schemaCount, 2);
  });

  it("mismatched fingerprint fails", () => {
    const result = verify({ expectedFingerprint: "0".repeat(64) });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /fingerprint mismatch/i);
  });

  it("matching path and schema counts are not enough when fingerprint mismatches", () => {
    const result = verify({
      expectedFingerprint: "1".repeat(64),
      expectedPathCount: 2,
      expectedSchemaCount: 2,
    });
    assert.equal(result.safeSummary.pathCount, 2);
    assert.equal(result.safeSummary.schemaCount, 2);
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /fingerprint mismatch/i);
  });

  it("missing OpenAPI fails", () => {
    const result = verify({ openApiJson: null });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /did not return a JSON object/i);
  });

  it("stale path and schema counts fail in strict mode", () => {
    const result = verify({ expectedPathCount: 3, expectedSchemaCount: 3 });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /path count mismatch/i);
    assert.match(result.blockers.join("\n"), /schema count mismatch/i);
  });

  it("health non-200 fails", () => {
    const result = verify({ healthStatus: 503 });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /\/health returned 503/i);
  });

  it("ready non-200 fails", () => {
    const result = verify({ readyStatus: 503 });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /\/ready returned 503/i);
  });

  it("ready provider not MOCK fails", () => {
    const result = verify({ readyBody: readyBody({ provider: "SDXL" }) });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /provider mismatch/i);
  });

  it("ready database ok is preserved as safe summary", () => {
    const result = verify();
    assert.equal(result.safeSummary.databaseOk, true);
  });

  it("GPU worker offline does not fail", () => {
    const result = verify({ readyBody: readyBody({ worker: { gpu_status: "offline" } }) });
    assert.equal(result.ok, true);
    assert.equal(result.safeSummary.gpuWorkerOffline, true);
  });

  it("real generation ready marker fails", () => {
    const result = verify({ readyBody: readyBody({ realGenerationReady: true }) });
    assert.equal(result.ok, false);
    assert.match(result.blockers.join("\n"), /real generation/i);
  });

  it("helper does not call network", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("fetch must not be called");
    }) as typeof fetch;
    try {
      assert.equal(verify().ok, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("helper does not import server-only client-only or unsafe IO modules", () => {
    const source = readFileSync(new URL("../../lib/ai-media/render-contract-verification.ts", import.meta.url), "utf8");
    assert.equal(/server-only|client-only|\bfetch\s*\(|process\.env|@prisma\/client|@\/lib\/db|@vercel\/blob/.test(source), false);
  });

  it("output does not expose secret-like evidence", () => {
    const secret = "super-secret-token";
    const result = verify({
      healthBody: { status: "ok", token: secret },
      readyBody: readyBody({ password: secret }),
      openApiJson: {
        ...sampleOpenApi(),
        components: {
          schemas: {
            Safe: { type: "object" },
            SecretInput: { type: "object", properties: { token: { default: secret } } },
          },
        },
      },
      expectedPathCount: 2,
      expectedSchemaCount: 2,
    });
    assert.equal(JSON.stringify(result).includes(secret), false);
  });
});
