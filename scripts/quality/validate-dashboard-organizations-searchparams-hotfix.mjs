import { readFileSync } from "node:fs";

const page = readFileSync("app/[locale]/dashboard/organizations/page.tsx", "utf8");

const checks = [
  ["explicit SearchParams typing", "const resolvedSearchParams: SearchParams = searchParams ? await searchParams : {};"],
  ["separate params resolution", "const { locale: rawLocale } = await params;"],
  ["query q is still wired", "firstParam(resolvedSearchParams.q)"],
  ["query type is still wired", "firstParam(resolvedSearchParams.type)"],
  ["query status is still wired", "firstParam(resolvedSearchParams.status)"],
  ["query page is still wired", "firstParam(resolvedSearchParams.page)"],
];

const missing = checks.filter(([, needle]) => !page.includes(needle));

if (missing.length) {
  console.error("Dashboard organizations searchParams hotfix validation failed:");
  for (const [label] of missing) console.error(`- Missing ${label}`);
  process.exit(1);
}

console.log("Dashboard organizations searchParams hotfix validation passed.");
