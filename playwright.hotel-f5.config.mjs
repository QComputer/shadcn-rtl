import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const storageState = process.env.HOTEL_F5_VERCEL_STORAGE_STATE;

export default defineConfig({
  testDir: "./tests/e2e/hotel-f5",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.HOTEL_F5_APP_URL || "https://hotel-f5-staging.invalid",
    storageState: storageState ? resolve(storageState) : undefined,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  globalSetup: "./tests/e2e/hotel-f5/global-setup.mjs",
});
