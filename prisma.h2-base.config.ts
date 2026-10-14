import { defineConfig, env } from "prisma/config";

/** CI-only migration staging for proving legacy rows survive the new final migration. */
export default defineConfig({
  schema: process.env.H2_BASE_SCHEMA ?? "prisma/schema.prisma",
  migrations: { path: process.env.H2_BASE_MIGRATIONS ?? "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
