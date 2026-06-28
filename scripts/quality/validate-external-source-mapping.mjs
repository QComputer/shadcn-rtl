#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const results = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function add(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail })
}

const helper = exists("lib/import-hub/source-mapping.ts") ? read("lib/import-hub/source-mapping.ts") : ""
const service = read("lib/services/import-hub.service.ts")
const route = exists("app/api/dashboard/imports/jobs/[jobId]/resolve/route.ts")
  ? read("app/api/dashboard/imports/jobs/[jobId]/resolve/route.ts")
  : ""
const page = read("app/[locale]/dashboard/imports/page.tsx")
const types = read("lib/import-hub/types.ts")
const packageJson = read("package.json")
const validateProject = read("scripts/quality/validate-project.mjs")

add("source mapping helper exists", exists("lib/import-hub/source-mapping.ts"))
add("helper maps external IDs and URLs", /sourceExternalId/.test(helper) && /sourceUrl/.test(helper) && /findExistingExternalDraftMappings/.test(helper))
add("helper builds re-import diffs", /buildReimportDiffSummary/.test(helper) && /changedFields/.test(helper) && /unchangedFields/.test(helper))
add("helper exposes merge skip create-new decisions", /MERGE/.test(helper) && /SKIP/.test(helper) && /CREATE_NEW/.test(helper))
add("service applies re-import metadata to product drafts", /withReimportMetadata/.test(service) && /importedProductDraft\.createMany/.test(service))
add("service applies re-import metadata to content drafts", /withReimportWarning/.test(service) && /importedContentDraft\.createMany/.test(service))
add("service records P76 source metadata", /P76_EXTERNAL_SOURCE_MAPPING_REIMPORT_DIFF/.test(service) && /reimportDiffEnabled/.test(service))
add("service audits re-import decisions", /resolveReimportDrafts/.test(service) && /Re-import draft resolution recorded/.test(service) && /writeAuditLog/.test(service))
add("types expose re-import decisions", /reimportResolutionDecisions/.test(types) && /ResolveReimportDraftsInput/.test(types))
add("resolve route exists", exists("app/api/dashboard/imports/jobs/[jobId]/resolve/route.ts"))
add("resolve route is org-scoped and authenticated", /requireAuthSession/.test(route) && /requireOrgAccess/.test(route) && /getJobOrganizationId/.test(route))
add("resolve route validates decisions", /z\.enum\(reimportResolutionDecisions\)/.test(route))
add("dashboard shows duplicate diff evidence", /copy\.duplicate/.test(page) && /diffSummary/.test(page))
add("dashboard exposes merge skip create-new controls", /resolveReimport\("MERGE"\)/.test(page) && /resolveReimport\("SKIP"\)/.test(page) && /resolveReimport\("CREATE_NEW"\)/.test(page))
add("package script exposes P76 validator", /"quality:external-source-mapping":\s*"node scripts\/quality\/validate-external-source-mapping\.mjs"/.test(packageJson))
add("project validator references P76 validator", /validate-external-source-mapping\.mjs/.test(validateProject))
add("P76 phase doc exists", exists("docs/PHASE_76_EXTERNAL_SOURCE_MAPPING.md"))
add("README references P76", /P76/.test(read("README.md")) && /External Source Mapping/.test(read("README.md")))
add("current source of truth references P76", /P76/.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")) && /external source mapping/i.test(read("docs/CURRENT_SOURCE_OF_TRUTH.md")))

console.table(results)
const failed = results.filter((result) => !result.ok)
if (failed.length) {
  console.error(`External source mapping validation failed with ${failed.length} issue(s).`, failed)
  process.exit(1)
}

console.log("External source mapping validation passed.")
