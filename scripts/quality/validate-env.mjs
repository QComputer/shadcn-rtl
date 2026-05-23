#!/usr/bin/env node
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

console.table(issues.length ? issues : [{ name: "runtime env", severity: "ok", message: "Environment validation passed." }]);
if (issues.some((issue) => issue.severity === "error")) process.exit(1);
