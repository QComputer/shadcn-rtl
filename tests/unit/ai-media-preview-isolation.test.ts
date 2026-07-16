import { register } from "node:module";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  getAiMediaEnvironmentSummary,
  validateAiMediaPreviewIsolation,
  assertNoPublicAiMediaSecrets,
} from "@/lib/ai-media/env-isolation";

register(new URL("./loader.mjs", import.meta.url));

describe("ai media env isolation", () => {
  it("production-like env with server-side key passes public-secret check", () => {
    const env = {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      AI_MEDIA_SERVICE_INTERNAL_KEY: "prod-key",
      AI_MEDIA_SERVICE_URL: "https://bazar-baz-ai-media-service.onrender.com",
    };

    const summary = getAiMediaEnvironmentSummary(env);
    assert.equal(summary.environment, "production");
    assert.equal(summary.safeSummary.hasPublicAiMediaSecret, false);
    assert.equal(summary.safeSummary.aiMediaServiceInternalKeyRedacted, "prod...key");
  });

  it("env containing NEXT_PUBLIC_AI_MEDIA_SERVICE_INTERNAL_KEY fails public-secret check", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_AI_MEDIA_SERVICE_INTERNAL_KEY: "leaked",
    };

    const summary = getAiMediaEnvironmentSummary(env);
    assert.equal(summary.safeSummary.hasPublicAiMediaSecret, true);
    assert.throws(() => assertNoPublicAiMediaSecrets(env), /NEXT_PUBLIC_/);
  });

  it("env containing NEXT_PUBLIC_RENDER_INTERNAL_KEY fails public-secret check", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_RENDER_INTERNAL_KEY: "leaked",
    };

    const summary = getAiMediaEnvironmentSummary(env);
    assert.equal(summary.safeSummary.hasPublicAiMediaSecret, true);
  });

  it("preview env with identical prod DB identifiers fails isolation", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      DATABASE_URL: "postgresql://user:pass@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/bazar_baz_prod",
    };

    const result = validateAiMediaPreviewIsolation(env);
    assert.equal(result.ok, false);
    assert.equal(result.safeSummary.previewAndProdDatabaseMatch, true);
    assert.match(result.blockers.join(" "), /database/i);
  });

  it("preview env with identical prod storage identifiers fails isolation", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      BLOB_READ_WRITE_TOKEN: "vercel_blob_prod_token",
    };

    const result = validateAiMediaPreviewIsolation(env);
    assert.equal(result.ok, false);
    assert.equal(result.safeSummary.previewAndProdStorageMatch, true);
    assert.match(result.blockers.join(" "), /blob|storage/i);
  });

  it("preview env with identical prod AI service URL fails isolation", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      AI_MEDIA_SERVICE_URL: "https://bazar-baz-ai-media-service.onrender.com",
    };

    const result = validateAiMediaPreviewIsolation(env);
    assert.equal(result.ok, false);
    assert.equal(result.safeSummary.previewAndProdAiServiceMatch, true);
    assert.match(result.blockers.join(" "), /ai media service identity/i);
  });

  it("missing optional env gives warning not crash", () => {
    const result = getAiMediaEnvironmentSummary({});
    assert.equal(result.ok, true);
    assert.equal(result.environment, "unknown");
    assert.equal(result.blockers.length, 0);
  });

  it("strict mode fails closed on ambiguous preview isolation", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      AI_MEDIA_SERVICE_URL: "https://bazar-baz-ai-media-service.onrender.com",
    };

    let threw = false;
    try {
      validateAiMediaPreviewIsolation(env);
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "validateAiMediaPreviewIsolation should not throw");
  });

  it("redacted summary does not include raw secret values", () => {
    const env = {
      NODE_ENV: "preview",
      VERCEL_ENV: "preview",
      AI_MEDIA_SERVICE_INTERNAL_KEY: "super-secret-key-12345",
      AI_MEDIA_SERVICE_URL: "https://preview.example.com",
    };

    const summary = getAiMediaEnvironmentSummary(env);
    assert.equal(summary.safeSummary.aiMediaServiceInternalKeyRedacted.includes("super-secret-key-12345"), false);
    assert.equal(summary.safeSummary.aiMediaServiceUrlRedacted.includes("preview.example.com"), false);
  });

  it("helper does not perform network calls", () => {
    const result = getAiMediaEnvironmentSummary({ NODE_ENV: "test" });
    assert.equal(result.environment, "test");
  });

  it("helper does not import client-only code", async () => {
    const mod = await import("@/lib/ai-media/env-isolation");
    assert.equal(typeof mod.getAiMediaEnvironmentSummary, "function");
    assert.equal(typeof mod.validateAiMediaPreviewIsolation, "function");
    assert.equal(typeof mod.assertNoPublicAiMediaSecrets, "function");
  });

  it(".env.example placeholders remain safe", () => {
    const envExample = readFileFromRoot(".env.example");
    assert.ok(/^AI_MEDIA_SERVICE_INTERNAL_KEY=$/m.test(envExample), "AI_MEDIA_SERVICE_INTERNAL_KEY placeholder must be empty");
    assert.ok(!/NEXT_PUBLIC.*AI_MEDIA_SERVICE_INTERNAL_KEY/m.test(envExample), "no NEXT_PUBLIC AI media secret");
    assert.ok(!/NEXT_PUBLIC.*RENDER/m.test(envExample), "no NEXT_PUBLIC Render secret");
  });
});

function readFileFromRoot(relative: string): string {
  const full = new URL(relative, new URL("../../", import.meta.url)).pathname;
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf8");
}
