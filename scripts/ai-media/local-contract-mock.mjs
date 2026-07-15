#!/usr/bin/env node
import http from "node:http";
import { randomUUID } from "node:crypto";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.AI_MEDIA_CONTRACT_MOCK_PORT || "4765", 10);
const expectedKey = process.env.AI_MEDIA_SERVICE_INTERNAL_KEY || "local-ai-media-test-key";
const jobs = new Map();
const idempotency = new Map();
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(data.length),
  });
  res.end(data);
}

function unauthorized(res) {
  json(res, 401, { detail: "Unauthorized" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function publicJob(job) {
  return {
    job_id: job.job_id,
    status: job.status,
    provider: "MOCK",
    organization_id: job.organization_id,
    product_id: job.product_id,
    requested_by_user_id: job.requested_by_user_id,
    created_at: job.created_at,
    updated_at: new Date().toISOString(),
    outputs: job.outputs,
    output_images: job.outputs.map((output) => output.url),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  if (url.pathname === "/ready") return json(res, 200, { ready: true, provider: "MOCK" });
  if (url.pathname === "/openapi.json") {
    return json(res, 200, {
      openapi: "3.1.0",
      info: { title: "Bazar Baz AI Media Service", version: "0.1.0" },
      paths: {
        "/v1/product-image-suggestions/jobs": { post: { operationId: "createProductImageSuggestionJob" } },
        "/v1/product-image-suggestions/jobs/{job_id}": { get: { operationId: "getProductImageSuggestionJob" } },
        "/v1/product-image-suggestions/jobs/{job_id}/cancel": { post: { operationId: "cancelProductImageSuggestionJob" } },
      },
      components: { schemas: {}, securitySchemes: {} },
    });
  }
  if (url.pathname === "/fixtures/result.png") {
    res.writeHead(200, { "content-type": "image/png", "content-length": String(png.length) });
    return res.end(png);
  }

  if (req.headers["x-bazarbaz-ai-key"] !== expectedKey) return unauthorized(res);

  if (req.method === "POST" && url.pathname === "/v1/product-image-suggestions/jobs") {
    const body = await readBody(req);
    const key = req.headers["idempotency-key"] || body.idempotency_key || randomUUID();
    if (idempotency.has(key)) return json(res, 200, publicJob(jobs.get(idempotency.get(key))));
    const jobId = `mock-${randomUUID()}`;
    const now = new Date().toISOString();
    const job = {
      job_id: jobId,
      status: "COMPLETED",
      provider: "MOCK",
      organization_id: body.organization_id,
      product_id: body.product_id,
      requested_by_user_id: body.requested_by_user_id,
      created_at: now,
      updated_at: now,
      outputs: [{ url: `http://${host}:${port}/fixtures/result.png`, mime_type: "image/png", width: 1, height: 1, prompt_used: body.seller_prompt || null, seed: 1 }],
    };
    jobs.set(jobId, job);
    idempotency.set(key, jobId);
    return json(res, 201, publicJob(job));
  }

  const statusMatch = url.pathname.match(/^\/v1\/product-image-suggestions\/jobs\/([^/]+)$/);
  if (req.method === "GET" && statusMatch) {
    const job = jobs.get(statusMatch[1]);
    if (!job) return json(res, 404, { detail: "Job not found" });
    return json(res, 200, publicJob(job));
  }

  const cancelMatch = url.pathname.match(/^\/v1\/product-image-suggestions\/jobs\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelMatch) {
    const job = jobs.get(cancelMatch[1]);
    if (!job) return json(res, 404, { detail: "Job not found" });
    if (job.status === "COMPLETED") return json(res, 409, { detail: "Job already completed" });
    job.status = "CANCELED";
    return json(res, 200, publicJob(job));
  }

  return json(res, 404, { detail: "Not found" });
});

server.listen(port, host, () => {
  console.log(`AI media local contract MOCK listening on http://${host}:${port}`);
});
