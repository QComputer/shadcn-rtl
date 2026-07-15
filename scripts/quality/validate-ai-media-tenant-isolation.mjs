import fs from "node:fs";

const checks = [];
const read = (path) => fs.readFileSync(path, "utf8");
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) });

const productRoute = read("app/api/dashboard/products/[productId]/ai-image-suggestions/route.ts");
const statusRoute = read("app/api/dashboard/ai-image-suggestions/[jobId]/route.ts");
const cancelRoute = read("app/api/dashboard/ai-image-suggestions/[jobId]/cancel/route.ts");
const creativeHelpers = read("app/api/dashboard/creative-studio/_helpers.ts");
const creativeRoutes = read("app/api/dashboard/creative-studio/jobs/route.ts") + read("app/api/dashboard/creative-studio/jobs/[jobId]/route.ts") + read("app/api/dashboard/creative-studio/jobs/[jobId]/cancel/route.ts");
const service = read("lib/services/creative-studio.service.ts");
const packageJson = read("package.json");

add("product route requires auth and product access", /requireAuthSession/.test(productRoute) && /requireProductAccess/.test(productRoute));
add("status route checks local job tenant ownership", /getLocalJob/.test(statusRoute) && /localJob\.organizationId !== session\.user\.organizationId/.test(statusRoute));
add("cancel route requires organization access", /requireOrgAccess/.test(cancelRoute) && /getLocalJob/.test(cancelRoute));
add("Creative Studio helper requires auth and org access", /requireAuthSession/.test(creativeHelpers) && /requireOrgAccess/.test(creativeHelpers));
add("Creative Studio routes use organization helper", /requireCreativeStudioOrganization/.test(creativeRoutes) && /creativeStudioService\.getJob/.test(creativeRoutes) && /creativeStudioService\.cancelJob/.test(creativeRoutes));
add("service verifies target ownership", /where: \{ id: input\.targetId, organizationId/.test(service));
add("service guards wrong-tenant job lookup", /where: \{ id: jobId, organizationId \}/.test(service));
add("service guards wrong-tenant cancellation", /where: \{ id: jobId, organizationId \}/.test(service) && /Only queued or processing/.test(service));
add("package exposes tenant isolation validator", /quality:ai-media-tenant-isolation/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`\n${failed.length} AI media tenant isolation check(s) failed.`);
  process.exit(1);
}
