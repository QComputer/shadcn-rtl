#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  const fullPath = path.join(root, rel);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

const page = read("app/[locale]/onboarding/page.tsx");
const wizard = read("app/[locale]/onboarding/wizard.tsx");
const content = read("lib/content/b2b-onboarding-wizard-content.ts");
const requestDemoPage = read("app/[locale]/request-demo/page.tsx");
const contactPage = read("app/[locale]/contact/page.tsx");
const homePage = read("app/[locale]/page.tsx");
const layout = read("app/[locale]/layout.tsx");
const packageJson = JSON.parse(read("package.json"));
const roadmap = read("docs/NEXT_PHASE_ROADMAP.md");

add("onboarding wizard page exists", page.length > 0);
add("onboarding wizard client exists", wizard.length > 0);
add("onboarding content module exists", content.length > 0);

if (page.length > 0) {
  add("onboarding page has Persian SEO title", /ویزارد راه‌اندازی کسب‌وکار/.test(page) || /onboardingWizardContent\.fa\.seo/.test(page));
  add("onboarding page renders BusinessOnboardingWizard", /BusinessOnboardingWizard/.test(page));
  add("onboarding page links back to request-demo", /\/request-demo/.test(page));
  add("onboarding page links to dashboard showcase", /\/dashboard-showcase/.test(page));
}

if (wizard.length > 0) {
  add("wizard has multi-step state", /content\.steps/.test(wizard) && /setStep/.test(wizard));
  add("wizard collects business type", /businessType/.test(wizard) && /businessTypes/.test(wizard));
  add("wizard collects priorities", /priorities/.test(wizard) && /toggleValue/.test(wizard));
  add("wizard collects readiness", /readiness/.test(wizard));
  add("wizard computes recommendation", /recommendation/.test(wizard) && /getBusinessPath/.test(wizard));
  add("wizard submits to safe request-demo API", /fetch\("\/api\/request-demo"/.test(wizard));
  add("wizard sends onboarding summary", /business-onboarding-wizard/.test(wizard) && /needSummary/.test(wizard));
  add("wizard requires consent", /consent/.test(wizard) && /consentAccepted/.test(wizard));
  add("wizard does not create organizations", !/organization\.create|createOrganization|\/api\/organizations/.test(wizard));
  add("wizard does not create users", !/user\.create|createUser/.test(wizard));
  add("wizard does not send SMS", !/sms\.ir|sendSMS|SMS_IR/.test(wizard));
}

if (content.length > 0) {
  add("content is Persian-first", /fa:/.test(content) && /ویزارد راه‌اندازی/.test(content));
  add("content explains no tenant mutation", /حساب کاربری یا سازمان جدید نمی‌سازد/.test(content));
  add("content includes shop and appointment paths", /فروشگاهی/.test(content) && /نوبت‌دهی/.test(content));
  add("content includes domain readiness", /دامنه اختصاصی/.test(content));
}

add("homepage links to onboarding wizard", /\/onboarding/.test(homePage));
add("request-demo page links to onboarding wizard", /\/onboarding/.test(requestDemoPage));
add("contact page links to onboarding wizard", /\/onboarding/.test(contactPage));
add("layout footer links to onboarding wizard", /\/onboarding/.test(layout));
add(
  "package.json exposes quality:b2b-business-onboarding-wizard",
  packageJson.scripts?.["quality:b2b-business-onboarding-wizard"] ===
    "node scripts/quality/validate-b2b-business-onboarding-wizard.mjs",
);
add("roadmap marks BB-B2B-P12 complete", /BB-B2B-P12/.test(roadmap) && /business onboarding wizard/i.test(roadmap));

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`B2B business onboarding wizard validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("B2B business onboarding wizard validation passed.");
