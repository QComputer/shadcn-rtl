import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "artifacts/retail-performance-comparison");
const folders = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
const inputs = {};
for (const folder of folders.filter((item) => item.isDirectory())) {
  const name = folder.name.includes("merged-main") ? "main" : folder.name.includes("pr77") ? "pr77" : null;
  if (!name) continue;
  const file = path.join(root, folder.name, "performance-summary.json");
  try { inputs[name] = JSON.parse(await fs.readFile(file, "utf8")); }
  catch { inputs[name] = null; }
}

function median(values) {
  const finite = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function summarize(summary) {
  if (!summary) return { status: "NOT_AVAILABLE", reason: "The hosted job did not produce performance-summary.json" };
  const runs = summary.performance ?? [];
  const fields = ["documentBytes", "ssrCardCount", "hydratedCardCount", "hydrationProductDelta", "initialCatalogApiRequestCount", "cardMarkupBytes", "inlineFlightBytes", "javascriptTransferBytes", "javascriptResourceCount", "firstPaint", "firstContentfulPaint", "lcp", "cls", "documentTransferBytes", "documentEncodedBytes"];
  const metrics = Object.fromEntries(fields.map((field) => [field, median(runs.map((run) => run[field]))]));
  const requests = summary.initialRequests ?? [];
  metrics.documentRequests = median(requests.map((run) => run.document));
  metrics.rscRequests = median(requests.map((run) => run.rsc));
  metrics.imageMediaRequests = median(requests.map((run) => run.images));
  metrics.catalogApiRequests = median(requests.map((run) => run.catalogApi?.length));
  return {
    status: runs.length ? "MEASURED" : "NOT_AVAILABLE",
    sourceLabel: summary.sourceLabel,
    sourceSha: summary.sourceSha,
    repetitions: runs.length,
    metrics,
    themes: (summary.themePaints ?? []).map((run) => ({ label: run.label, themePass: run.themePass, firstPaint: run.firstPaint, fcp: run.fcp, fcpClass: run.fcpClass, fcpDataTheme: run.fcpDataTheme })),
    consoleErrors: summary.consoleErrors ?? [],
  };
}

const main = summarize(inputs.main);
const pr77 = summarize(inputs.pr77);
const deltas = {};
if (main.status === "MEASURED" && pr77.status === "MEASURED") {
  for (const [key, value] of Object.entries(pr77.metrics)) {
    const before = main.metrics[key];
    deltas[key] = typeof before === "number" && before !== 0 && typeof value === "number"
      ? { absolute: value - before, percent: ((value - before) / before) * 100 }
      : null;
  }
}
const result = {
  comparison: "merged-main vs PR77 under separate equivalent Ubuntu/Chromium/PostgreSQL 17 cold-run jobs",
  interpretation: "Positive/negative percentage is a measured difference only; it does not imply improvement without considering the metric direction and run variance.",
  main,
  pr77,
  pr77MinusMain: deltas,
};
await fs.writeFile(path.join(root, "comparison.json"), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
