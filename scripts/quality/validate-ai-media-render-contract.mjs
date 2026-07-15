import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function exists(path) {
  return fs.existsSync(path);
}

const checks = [];
function add(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

const client = read("lib/services/ai-media-service-client.ts");
const route = exists("app/api/dashboard/ai-media/contract/route.ts")
  ? read("app/api/dashboard/ai-media/contract/route.ts")
  : "";
const docs = exists("docs/ai-media/RENDER_SERVICE_CONTRACT.md")
  ? read("docs/ai-media/RENDER_SERVICE_CONTRACT.md")
  : "";
const dashboardPage = read("app/[locale]/dashboard/creative-studio/page.tsx");

add("server-only client exposes sanitized contract summary", /import "server-only"/.test(client) && /getAiMediaServiceContractSummary/.test(client));
add("contract helper fetches only openapi json", /\/openapi\.json/.test(client) && !/\/v1\/product-image-suggestions\/jobs[`"]\s*,\s*\{\s*method:\s*"POST"[\s\S]{0,120}getAiMediaServiceContractSummary/.test(client));
add("contract summary returns paths and schema names", /AiMediaContractPathSummary/.test(client) && /securitySchemes/.test(client) && /schemas/.test(client));
add("contract helper does not return raw response body", !/rawBody/.test(client) && !/responseText/.test(client));
add("dashboard contract route exists", Boolean(route));
add("contract route requires auth", /requireAuthSession/.test(route));
add("contract route requires SUPER_ADMIN", /requireRole\(session, \["SUPER_ADMIN"\]\)/.test(route));
add("contract route returns explicit secretless flags", /secretValuesReturned:\s*false/.test(route) && /rawBodyReturned:\s*false/.test(route));
add("client UI does not import contract helper", !/getAiMediaServiceContractSummary|\/api\/dashboard\/ai-media\/contract/.test(dashboardPage));
add("contract doc exists", Boolean(docs));
add("contract doc records local direct access limitation", /private.*10\.x|workspace cannot reach/i.test(docs));
add("contract doc records no generation request during discovery", /No generation request was sent/i.test(docs));

console.table(checks);
const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`AI media Render contract validation failed (${failed.length})`);
  process.exit(1);
}

console.log("AI media Render contract validation passed.");
