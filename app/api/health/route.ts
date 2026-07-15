import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateRuntimeEnvironment } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthStatus = "ok" | "degraded";

function nowIso() {
  return new Date().toISOString();
}

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const deep = ["1", "true", "yes"].includes((request.nextUrl.searchParams.get("deep") || "").toLowerCase());
  const env = validateRuntimeEnvironment();
  const database = {
    checked: deep,
    ok: null as boolean | null,
    latencyMs: null as number | null,
    error: null as string | null,
  };

  if (deep) {
    const dbStartedAt = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      database.ok = true;
    } catch {
      database.ok = false;
      database.error = "Database connectivity check failed.";
    } finally {
      database.latencyMs = Date.now() - dbStartedAt;
    }
  }

  const status: HealthStatus = env.ok && (!deep || database.ok === true) ? "ok" : "degraded";
  const uptimeSec = typeof process.uptime === "function" ? Math.round(process.uptime()) : null;

  return noStoreJson(
    {
      status,
      service: "bazar-baz",
      timestamp: nowIso(),
      uptimeSec,
      latencyMs: Date.now() - startedAt,
      checks: {
        environment: {
          ok: env.ok,
          summary: env.summary,
          issues: env.issues,
        },
        database,
      },
    },
    status === "ok" ? 200 : 503,
  );
}
