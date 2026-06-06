#!/usr/bin/env node
import { config as loadDotEnv } from "dotenv";

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

console.table(issues.length ? issues : [{ name: "runtime env", severity: "ok", message: "Environment validation passed." }]);
if (issues.some((issue) => issue.severity === "error")) process.exit(1);
