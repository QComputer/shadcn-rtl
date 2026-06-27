#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function loadDotEnv(file = ".env") {
  const abs = path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) return;

  for (const rawLine of fs.readFileSync(abs, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    const value = rawValue
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    process.env[key] = value;
  }
}

loadDotEnv();

const issues = [];

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function add(name, severity, message) {
  issues.push({ name, severity, message });
}

if (!hasValue(process.env.DATABASE_URL)) {
  add("DATABASE_URL", "error", "DATABASE_URL is required.");
} else if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
  add("DATABASE_URL", "warning", "DATABASE_URL does not look like a PostgreSQL URL.");
}

if (process.env.NODE_ENV === "production" && !hasValue(process.env.NEXTAUTH_SECRET)) {
  add("NEXTAUTH_SECRET", "error", "NEXTAUTH_SECRET is required in production.");
}

const mediaStorageDriver = process.env.MEDIA_STORAGE_DRIVER || "";
const allowedMediaStorageDrivers = new Set(["", "local", "vercel_blob"]);

if (!allowedMediaStorageDrivers.has(mediaStorageDriver)) {
  add("MEDIA_STORAGE_DRIVER", "error", "MEDIA_STORAGE_DRIVER must be either local or vercel_blob when set.");
}

if (mediaStorageDriver === "vercel_blob" && !hasValue(process.env.BLOB_READ_WRITE_TOKEN)) {
  add("BLOB_READ_WRITE_TOKEN", "error", "BLOB_READ_WRITE_TOKEN is required when MEDIA_STORAGE_DRIVER=vercel_blob.");
}

if (mediaStorageDriver !== "vercel_blob" && !hasValue(process.env.BLOB_READ_WRITE_TOKEN)) {
  add("BLOB_READ_WRITE_TOKEN", "warning", "Uploads will use local ../uploads storage. Set BLOB_READ_WRITE_TOKEN for durable Vercel Blob storage.");
}

const hasGoogleClientId = hasValue(process.env.GOOGLE_CLIENT_ID);
const hasGoogleClientSecret = hasValue(process.env.GOOGLE_CLIENT_SECRET);
if (hasGoogleClientId !== hasGoogleClientSecret) {
  add("GOOGLE_OAUTH", "warning", "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.");
}


const smsProvider = process.env.SMS_PROVIDER || "dry_run";
const smsDryRun = process.env.SMS_DRY_RUN !== "false";
const allowedSmsProviders = new Set(["dry_run", "sms_ir"]);

if (!allowedSmsProviders.has(smsProvider)) {
  add("SMS_PROVIDER", "error", "SMS_PROVIDER must be either dry_run or sms_ir.");
}

if (smsProvider === "sms_ir" && !smsDryRun) {
  if (!hasValue(process.env.SMS_IR_API_KEY)) {
    add("SMS_IR_API_KEY", "error", "SMS_IR_API_KEY is required when SMS_PROVIDER=sms_ir and SMS_DRY_RUN=false.");
  }

  if (!hasValue(process.env.SMS_IR_LINE_NUMBER)) {
    add("SMS_IR_LINE_NUMBER", "error", "SMS_IR_LINE_NUMBER is required when SMS_PROVIDER=sms_ir and SMS_DRY_RUN=false.");
  }

  if (process.env.NODE_ENV !== "production") {
    add("SMS_DRY_RUN", "warning", "Real SMS sending is enabled outside production. Keep SMS_DRY_RUN=true for local, test, CI, and deployed smoke tests.");
  }
}

if (smsProvider === "sms_ir" && smsDryRun && !hasValue(process.env.SMS_IR_LINE_NUMBER)) {
  add("SMS_IR_LINE_NUMBER", "warning", "SMS_IR_LINE_NUMBER is not required for dry-run mode, but set it in production secret storage before disabling SMS_DRY_RUN.");
}

const webPushProvider = process.env.WEB_PUSH_PROVIDER || "dry_run";
const webPushDryRun = process.env.WEB_PUSH_DRY_RUN !== "false";
const webPushRealSendEnabled = process.env.WEB_PUSH_REAL_SEND_ENABLED === "true";
const allowedWebPushProviders = new Set(["dry_run", "web_push"]);

if (!allowedWebPushProviders.has(webPushProvider)) {
  add("WEB_PUSH_PROVIDER", "error", "WEB_PUSH_PROVIDER must be either dry_run or web_push.");
}

if (!hasValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)) {
  add("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY", "warning", "Set NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY before enabling browser Web Push opt-in.");
}

if (webPushProvider === "web_push" && webPushRealSendEnabled && !webPushDryRun) {
  if (!hasValue(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)) {
    add("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY", "error", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY is required when real Web Push is enabled.");
  }

  if (!hasValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY)) {
    add("WEB_PUSH_VAPID_PRIVATE_KEY", "error", "WEB_PUSH_VAPID_PRIVATE_KEY is required when real Web Push is enabled.");
  }

  if (!hasValue(process.env.WEB_PUSH_VAPID_SUBJECT)) {
    add("WEB_PUSH_VAPID_SUBJECT", "error", "WEB_PUSH_VAPID_SUBJECT is required when real Web Push is enabled.");
  }

  if (process.env.NODE_ENV !== "production") {
    add("WEB_PUSH_REAL_SEND_ENABLED", "warning", "Real Web Push sending is enabled outside production. Keep WEB_PUSH_DRY_RUN=true for local, test, CI, and deployed smoke tests.");
  }
}

if (webPushProvider === "web_push" && webPushDryRun && !hasValue(process.env.WEB_PUSH_VAPID_PRIVATE_KEY)) {
  add("WEB_PUSH_VAPID_PRIVATE_KEY", "warning", "WEB_PUSH_VAPID_PRIVATE_KEY is not required for dry-run mode, but set it in production secret storage before disabling WEB_PUSH_DRY_RUN.");
}

console.table(issues.length ? issues : [{ name: "runtime env", severity: "ok", message: "Environment validation passed." }]);
if (issues.some((issue) => issue.severity === "error")) process.exit(1);
