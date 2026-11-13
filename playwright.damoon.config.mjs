import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/damoon",
  testMatch: "booking-request-acceptance.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  outputDir: ".tmp/damoon-playwright-results",
  use: {
    baseURL: process.env.DAMOON_STANDALONE_URL,
    headless: true,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});
