import { URL } from "node:url";

const required = [
  "HOTEL_F5_E2E_ENABLED",
  "HOTEL_F5_APP_URL",
  "HOTEL_F5_PUBLIC_PAGE_URL",
  "HOTEL_F5_PUBLIC_ORIGIN",
  "HOTEL_F5_FOREIGN_PUBLIC_ORIGIN",
  "HOTEL_F5_UNKNOWN_DOMAIN_API_URL",
  "HOTEL_F5_INACTIVE_DOMAIN_API_URL",
  "HOTEL_F5_FOREIGN_DOMAIN_API_URL",
  "HOTEL_F5_CAPABILITY_DISABLED_API_URL",
  "HOTEL_F5_PUBLIC_GATE_OFF_API_URL",
  "HOTEL_F5_ORGANIZATION_ID",
  "HOTEL_F5_PROPERTY_ID",
  "HOTEL_F5_PROPERTY_SLUG",
  "HOTEL_F5_FOREIGN_ORGANIZATION_ID",
  "HOTEL_F5_FOREIGN_PROPERTY_ID",
  "HOTEL_F5_AUTHOR_USERNAME",
  "HOTEL_F5_AUTHOR_PASSWORD",
  "HOTEL_F5_REVIEWER_USERNAME",
  "HOTEL_F5_REVIEWER_PASSWORD",
  "HOTEL_F5_MANAGER_USERNAME",
  "HOTEL_F5_MANAGER_PASSWORD",
  "HOTEL_F5_FOREIGN_USERNAME",
  "HOTEL_F5_FOREIGN_PASSWORD",
  "HOTEL_F5_SYNTHETIC_MEDIA_ID",
  "HOTEL_F5_FOREIGN_MEDIA_IMAGE_ID",
  "HOTEL_F5_FOREIGN_MEDIA_ASSOCIATION_ID",
  "HOTEL_F5_FIXTURE_TAG",
  "HOTEL_F5_VERCEL_PROTECTION_BYPASS",
  "HOTEL_F5_WEBSITE_GATE_ENABLED_FOR_TEST",
  "HOTEL_F5_BOOKING_GATE_DISABLED_FOR_TEST",
  "HOTEL_F5_PAYMENT_GATE_DISABLED_FOR_TEST",
  "HOTEL_F5_NOTIFICATION_GATE_DISABLED_FOR_TEST",
];

function stagingUrl(name, value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute URL`); }
  const host = url.hostname.toLowerCase();
  const stagingHost = /(^|[.-])(f5|staging)([.-]|$)/i.test(host);
  const forbidden = ["bazar-baz.ir", "akashoes.ir", "damoon-hotel.ir", "neon.tech"]
    .some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (url.protocol !== "https:" || !stagingHost || forbidden) {
    throw new Error(`${name} must be an HTTPS F5/staging host and not a production host`);
  }
  return url;
}

export default async function globalSetup() {
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`F5 staging suite is not configured; missing ${missing.join(", ")}`);
  if (process.env.HOTEL_F5_E2E_ENABLED !== "1") throw new Error("Set HOTEL_F5_E2E_ENABLED=1 only for the isolated F5 staging run");
  for (const name of ["HOTEL_F5_APP_URL", "HOTEL_F5_PUBLIC_PAGE_URL", "HOTEL_F5_PUBLIC_ORIGIN", "HOTEL_F5_FOREIGN_PUBLIC_ORIGIN"]) {
    stagingUrl(name, process.env[name]);
  }
  for (const name of ["HOTEL_F5_PUBLIC_ORIGIN", "HOTEL_F5_FOREIGN_PUBLIC_ORIGIN"]) {
    const url = new URL(process.env[name]);
    if (url.pathname !== "/" || url.search || url.hash) throw new Error(`${name} must be an origin without a path`);
  }
  for (const name of ["HOTEL_F5_UNKNOWN_DOMAIN_API_URL", "HOTEL_F5_INACTIVE_DOMAIN_API_URL", "HOTEL_F5_FOREIGN_DOMAIN_API_URL", "HOTEL_F5_CAPABILITY_DISABLED_API_URL", "HOTEL_F5_PUBLIC_GATE_OFF_API_URL"]) {
    const url = stagingUrl(name, process.env[name]);
    if (!url.pathname.startsWith("/api/hotel/v1/website/properties/")) {
      throw new Error(`${name} must target the public Hotel website API`);
    }
  }
  if (process.env.HOTEL_F5_WEBSITE_GATE_ENABLED_FOR_TEST !== "1") throw new Error("The Hotel website public-read gate must be explicitly enabled in isolated staging for this test run");
  for (const name of ["HOTEL_F5_BOOKING_GATE_DISABLED_FOR_TEST", "HOTEL_F5_PAYMENT_GATE_DISABLED_FOR_TEST", "HOTEL_F5_NOTIFICATION_GATE_DISABLED_FOR_TEST"]) {
    if (process.env[name] !== "1") throw new Error(`${name} must confirm the corresponding operation remains disabled`);
  }
  const tag = process.env.HOTEL_F5_FIXTURE_TAG;
  if (!/^F5-SYNTHETIC-[A-Z0-9-]{4,40}$/.test(tag)) throw new Error("HOTEL_F5_FIXTURE_TAG must identify synthetic-only test content");
  if (process.env.HOTEL_F5_AUTHOR_USERNAME === process.env.HOTEL_F5_REVIEWER_USERNAME) throw new Error("Author and reviewer accounts must be distinct");
  if (process.env.HOTEL_F5_SYNTHETIC_MEDIA_ID === process.env.HOTEL_F5_FOREIGN_MEDIA_IMAGE_ID) throw new Error("The eligible and foreign-tenant media fixtures must be distinct");
  if (!/^[A-Za-z0-9]{32}$/.test(process.env.HOTEL_F5_VERCEL_PROTECTION_BYPASS)) {
    throw new Error("HOTEL_F5_VERCEL_PROTECTION_BYPASS must be the project automation bypass configured for this isolated staging run");
  }
}
