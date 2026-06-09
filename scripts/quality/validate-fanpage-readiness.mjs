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

const orgLayout = read("app/[locale]/organizations/[slug]/layout.tsx");
add("organization public layout uses explicit select", /select:\s*{[\s\S]*id:\s*true[\s\S]*name:\s*true[\s\S]*slug:\s*true[\s\S]*type:\s*true/.test(orgLayout));
add("organization public layout filters active records", /isActive:\s*true/.test(orgLayout) && /deletedAt:\s*null/.test(orgLayout));
add("organization public layout avoids unsafe full findUnique", !/organization\.findUnique\(\s*{\s*where:\s*{\s*slug\s*}/.test(orgLayout));
add("organization public layout avoids server self-fetch metadata", !/NEXT_PUBLIC_APP_URL/.test(orgLayout) && !/fetch\(/.test(orgLayout));
add("organization public layout uses organization name in header", /organization\.name/.test(orgLayout) && !/>\s*Logo\s*</.test(orgLayout));

const orgPage = read("app/[locale]/organizations/[slug]/page.tsx");
const shopLayout = read("app/[locale]/shop/[slug]/layout.tsx");
add("follow button wired into appointment public page", /FollowButton/.test(orgPage) && /organizationId={organization\.id}/.test(orgPage));
add("follow button wired into shop layout", /FollowButton/.test(shopLayout) && /organizationId={organization\.id}/.test(shopLayout));
add("shop layout filters active records", /isActive:\s*true/.test(shopLayout) && /deletedAt:\s*null/.test(shopLayout));

const followButton = read("components/follow/follow-button.tsx");
add("follow button supports anonymous login prompt", /loginToFollow/.test(followButton) && /callbackUrl/.test(followButton));
add("follow button is locale-aware", /getDictionary/.test(followButton) && /organization\.follow/.test(followButton));
add("follow button exposes aria-pressed", /aria-pressed={isFollowing}/.test(followButton));
add("follow button has visible error state", /role="status"/.test(followButton) && /setError/.test(followButton));
add("follow button uses logical spacing", /ms-1/.test(followButton) && !/mr-1/.test(followButton));

const followService = read("lib/services/follow.service.ts");
add("follow revalidation covers configured locales", /supportedLocales/.test(followService) && /for \(const locale of supportedLocales\)/.test(followService));
add("follow revalidation does not hardcode Persian-only paths", !/revalidatePath\(`\/fa\//.test(followService));

for (const locale of ["fa", "en", "ar"]) {
  const dictionary = json(`dictionaries/${locale}.json`);
  const organization = dictionary.organization ?? {};
  for (const key of ["follow", "following", "loginToFollow", "followUpdateError", "fanpage"]) {
    add(`${locale} organization.${key} exists`, typeof organization[key] === "string" && organization[key].length > 0);
  }
}

add("fanpage route is not falsely implemented", !exists("app/[locale]/organizations/[slug]/fanpage/page.tsx"));
add("P28 documentation exists", exists("docs/PHASE_28_FOLLOW_FANPAGE_READINESS_CLEANUP.md"));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Fanpage readiness validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log("Fanpage readiness validation passed.");
