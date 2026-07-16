import { AI_MEDIA_PINNED_RENDER_CONTRACT } from "@/lib/ai-media/pinned-render-contract";
import { verifyPinnedRenderContractEvidence } from "@/lib/ai-media/render-contract-verification";

type EndpointResult = {
  status: number | null;
  body: unknown;
};

const args = new Map(
  process.argv.slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split("=");
      return [key, value.join("=")];
    }),
);

const baseUrl = (
  args.get("url")
  ?? process.env.AI_MEDIA_RENDER_READONLY_URL
  ?? AI_MEDIA_PINNED_RENDER_CONTRACT.deployedServiceUrl
).replace(/\/$/, "");
const expectedFingerprint = (
  args.get("expected-fingerprint")
  ?? process.env.AI_MEDIA_RENDER_EXPECTED_FINGERPRINT
  ?? AI_MEDIA_PINNED_RENDER_CONTRACT.openApiFingerprintSha256
).trim();

async function fetchJson(path: "/health" | "/ready" | "/openapi.json"): Promise<EndpointResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { "user-agent": "bazar-baz-ai-media-render-contract-readonly/1.0" },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true };
  }
  return { status: response.status, body };
}

function printSafeResult(label: string, result: EndpointResult) {
  console.log(`${label}: status=${result.status ?? "none"}`);
}

try {
  const [health, ready, openApi] = await Promise.all([
    fetchJson("/health"),
    fetchJson("/ready"),
    fetchJson("/openapi.json"),
  ]);

  printSafeResult("/health", health);
  printSafeResult("/ready", ready);
  printSafeResult("/openapi.json", openApi);

  const verification = verifyPinnedRenderContractEvidence({
    deployedUrl: baseUrl,
    healthStatus: health.status,
    healthBody: health.body,
    readyStatus: ready.status,
    readyBody: ready.body,
    openApiStatus: openApi.status,
    openApiJson: openApi.body,
    expectedFingerprint,
    expectedPathCount: AI_MEDIA_PINNED_RENDER_CONTRACT.pathCount,
    expectedSchemaCount: AI_MEDIA_PINNED_RENDER_CONTRACT.schemaCount,
    expectedProvider: AI_MEDIA_PINNED_RENDER_CONTRACT.expectedProvider,
  });

  console.log(`fingerprint=${verification.safeSummary.fingerprint ?? "none"}`);
  console.log(`expectedFingerprint=${verification.safeSummary.expectedFingerprint}`);
  console.log(`paths=${verification.safeSummary.pathCount}`);
  console.log(`schemas=${verification.safeSummary.schemaCount}`);
  console.log(`provider=${verification.safeSummary.provider ?? "unknown"}`);
  console.log(`databaseOk=${verification.safeSummary.databaseOk}`);
  console.log(`gpuWorkerOffline=${verification.safeSummary.gpuWorkerOffline}`);
  console.log(`p07Status=${verification.safeSummary.p07Status}`);

  for (const warning of verification.warnings) console.warn(`WARN ${warning}`);
  for (const blocker of verification.blockers) console.error(`FAIL ${blocker}`);

  if (!verification.ok) {
    console.error("AI media Render pinned contract read-only validation failed.");
    process.exitCode = 1;
  } else {
    console.log("AI media Render pinned contract read-only validation passed.");
  }
} catch (error) {
  console.error(`FAIL read-only Render contract check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
