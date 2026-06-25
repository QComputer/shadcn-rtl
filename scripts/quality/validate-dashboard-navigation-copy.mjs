#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function ok(name, detail = "") {
  results.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
}

function expectFile(rel) {
  exists(rel) ? ok(`${rel} exists`) : fail(`${rel} exists`);
}

function expectIncludes(rel, needle, label = `${rel} includes ${needle}`) {
  if (!exists(rel)) {
    fail(label, `${rel} is missing`);
    return;
  }
  const text = read(rel);
  text.includes(needle) ? ok(label) : fail(label);
}

function expectNotIncludes(rel, needle, label = `${rel} excludes ${needle}`) {
  if (!exists(rel)) {
    fail(label, `${rel} is missing`);
    return;
  }
  const text = read(rel);
  text.includes(needle) ? fail(label) : ok(label);
}

expectFile("components/dashboard/dashboard-shell.tsx");
expectFile("docs/PHASE_37_DASHBOARD_NAVIGATION_COPY.md");
expectFile("docs/PHASE_37_OVERLAY_MANIFEST.md");

expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "const dashboardShellCopy",
  "dashboard shell keeps localized shell copy in one typed map",
);
for (const locale of ["fa", "en", "ar"]) {
  expectIncludes(
    "components/dashboard/dashboard-shell.tsx",
    `${locale}: {`,
    `dashboard shell has ${locale} shell copy`,
  );
}
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "href=\"#dashboard-main-content\"",
  "dashboard shell exposes accessible skip link",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "id=\"dashboard-main-content\"",
  "dashboard shell main content has skip target",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<main",
  "dashboard shell uses semantic main landmark",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "aria-label={copy.mainContent}",
  "dashboard shell localizes main landmark label",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "lg:hidden",
  "dashboard shell mobile navigation header is mobile-only",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "hidden border-b px-6 py-2 lg:block",
  "dashboard breadcrumb is desktop-only to reduce mobile clutter",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "DashboardSidebarWithDict locale={locale} isMobile={false}",
  "desktop dashboard sidebar receives locale",
);
expectIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "isMobile={true}",
  "mobile dashboard sidebar trigger remains present",
);
expectNotIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "<Providers>",
  "dashboard shell does not restore duplicate root Providers wrapper",
);
expectNotIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "SessionProvider",
  "dashboard shell does not restore duplicate SessionProvider",
);
expectNotIncludes(
  "components/dashboard/dashboard-shell.tsx",
  "AuthProvider",
  "dashboard shell does not restore duplicate AuthProvider",
);

expectIncludes(
  "package.json",
  "\"quality:dashboard-navigation-copy\": \"node scripts/quality/validate-dashboard-navigation-copy.mjs\"",
  "package script exposes P37 validator",
);
expectIncludes(
  "scripts/quality/validate-project.mjs",
  "validate-dashboard-navigation-copy.mjs",
  "project validator references P37 validator",
);
expectIncludes(
  "README.md",
  "P37",
  "README references P37",
);
expectIncludes(
  "docs/CURRENT_SOURCE_OF_TRUTH.md",
  "P37",
  "source of truth references P37",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Dashboard navigation/copy validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}
console.log("Dashboard navigation/copy validation passed.");
