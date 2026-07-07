/**
 * Local smoke test for POST /api/request-demo.
 *
 * This script is intentionally self-contained. It does not start the Next.js
 * dev server. Instead, it assumes the app is already reachable at the
 * NEXT_PUBLIC_APP_URL origin (default http://localhost:3000) and submits a
 * single safe fake lead.
 *
 * It does not print full phone numbers.
 * It does not require production.
 * It does not send SMS.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function requestDemoSmoke() {
  const payload = {
    fullName: "امیر محمدی",
    businessName: "کافه تستی",
    businessType: "cafe",
    phone: "09123456789",
    city: "تهران",
    preferredContactTime: "صبح‌ها",
    needSummary: "نیاز به تست دمو",
    consentAccepted: true,
  };

  console.log("[request-demo-smoke] Submitting fake lead to", `${BASE_URL}/api/request-demo`);

  try {
    const response = await fetch(`${BASE_URL}/api/request-demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error("[request-demo-smoke] FAIL", response.status, data);
      process.exit(1);
    }

    console.log("[request-demo-smoke] OK", {
      status: response.status,
      message: data.message,
      leadId: data.leadId ? data.leadId.slice(0, 8) + "…" : undefined,
    });
  } catch (error) {
    console.error("[request-demo-smoke] ERROR", error.message);
    console.error("[request-demo-smoke] Hint: ensure the dev server is running at", BASE_URL);
    process.exit(1);
  }
}

requestDemoSmoke();
