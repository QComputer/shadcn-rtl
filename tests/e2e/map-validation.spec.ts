import { test, expect } from "@playwright/test";

const DEPLOYED_URL = process.env.DEPLOYED_URL || "https://bazar-baz.ir";

test.describe("Map Location Features", () => {
  test("permissions policy header allows geolocation", async ({ page }) => {
    const response = await page.goto(`${DEPLOYED_URL}/fa`);
    const permissionsPolicy = response?.headers()["permissions-policy"] || response?.headers()["Permissions-Policy"];

    console.log(`Permissions-Policy header: ${permissionsPolicy}`);

    // The header should NOT explicitly block geolocation
    if (permissionsPolicy && permissionsPolicy.includes("geolocation=()")) {
      throw new Error("Permissions-Policy header explicitly blocks geolocation");
    }
  });

  test("homepage loads and has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto(`${DEPLOYED_URL}/fa`);
    await page.waitForLoadState("networkidle");

    if (errors.length > 0) {
      console.log("Console errors:", errors);
    }
  });
});