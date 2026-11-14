import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/damoon",
  testMatch: "hotel-phase1-operational.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: ".tmp/damoon-operational-playwright-results",
  use: { headless: true, screenshot: "only-on-failure", trace: "retain-on-failure", video: "off" },
});
