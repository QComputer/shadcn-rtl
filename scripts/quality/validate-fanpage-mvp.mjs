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

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function json(rel) {
  return JSON.parse(read(rel));
}

add("fanpage Prisma model exists", /model\s+FanpagePost\s*{/.test(read("prisma/schema.prisma")));
add("fanpage migration exists", exists("prisma/migrations/20260609004000_add_fanpage_posts/migration.sql"));
add("fanpage migration is idempotent-safe", /CREATE TABLE IF NOT EXISTS\s+"FanpagePost"/.test(read("prisma/migrations/20260609004000_add_fanpage_posts/migration.sql")));
add("fanpage service exists", exists("lib/services/fanpage.service.ts"));
add("fanpage service uses explicit organization select", /select:\s*{[\s\S]*id:\s*true[\s\S]*slug:\s*true/.test(read("lib/services/fanpage.service.ts")));
add("fanpage service revalidates configured locales", /supportedLocales/.test(read("lib/services/fanpage.service.ts")) && /for \(const locale of supportedLocales\)/.test(read("lib/services/fanpage.service.ts")));

const routePath = "app/api/public/organizations/[slug]/fanpage/posts/route.ts";
add("fanpage posts API route exists", exists(routePath));
const route = exists(routePath) ? read(routePath) : "";
add("fanpage posts GET is public read-only", /export async function GET/.test(route) && /fanpageService\.listPublic/.test(route));
add("fanpage posts POST requires auth", /export async function POST/.test(route) && /requireAuthSession/.test(route));
add("fanpage posts POST requires org manage access by slug", /requireOrgManageAccessBySlug/.test(route));
add("fanpage posts POST validates body", /createFanpagePostSchema/.test(route) && /z\.object/.test(route));
add("fanpage posts POST rate-limited", /checkRateLimit/.test(route) && /fanpage-post/.test(route));

const pagePath = "app/[locale]/organizations/[slug]/fanpage/page.tsx";
add("public fanpage route exists", exists(pagePath));
const page = exists(pagePath) ? read(pagePath) : "";
add("fanpage page uses active non-deleted organization", /isActive:\s*true/.test(page) && /deletedAt:\s*null/.test(page));
add("fanpage page renders posts", /FanpagePostCard/.test(page) && /fanpagePost\.findMany/.test(page));
add("fanpage page gates create form by membership", /organizationMember\.findFirst/.test(page) && /FanpagePostForm/.test(page));

add("fanpage post card exists", exists("components/follow/fanpage-post-card.tsx"));
add("fanpage post form exists", exists("components/follow/fanpage-post-form.tsx"));
add("organization layout links fanpage", /organization\.fanpage/.test(read("app/[locale]/organizations/[slug]/layout.tsx")) && /\/fanpage/.test(read("app/[locale]/organizations/[slug]/layout.tsx")));
add("shop layout links fanpage", /organization\.fanpage/.test(read("app/[locale]/shop/[slug]/layout.tsx")) && /organizations\/\$\{organization\.slug\}\/fanpage/.test(read("app/[locale]/shop/[slug]/layout.tsx")));

for (const locale of ["fa", "en", "ar"]) {
  const dictionary = json(`dictionaries/${locale}.json`);
  for (const key of ["title", "subtitle", "emptyTitle", "emptyDescription", "createPost", "publish", "createError"]) {
    add(`${locale} fanpage.${key} exists`, typeof dictionary.fanpage?.[key] === "string" && dictionary.fanpage[key].length > 0);
  }
}

add("P30 documentation exists", exists("docs/PHASE_30_FANPAGE_MVP.md"));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Fanpage MVP validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log("Fanpage MVP validation passed.");
