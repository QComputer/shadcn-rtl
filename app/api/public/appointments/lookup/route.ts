import { NextRequest, NextResponse } from "next/server";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";

const GENERIC_RECOVERY_MESSAGE = "Tracking credentials are provided at booking. Phone based recovery is unavailable.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organizationSlug = typeof body?.organizationSlug === "string" ? body.organizationSlug.trim() : "";

    if (!organizationSlug) {
      return securedJson({ error: "Organization slug is required" }, 400);
    }

    const rateLimit = checkRateLimit({
      key: `appointment-lookup:${getClientIp(request.headers)}`,
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return securedJson({ error: "Too many requests. Please try again later." }, 429, {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      });
    }

    // Lookup is intentionally non-authorizing. OTP ownership recovery is not
    // available until it has a dedicated challenge flow without account/session side effects.
    return securedJson({ message: GENERIC_RECOVERY_MESSAGE });
  } catch {
    return securedJson({ error: "Internal server error" }, 500);
  }
}

function securedJson(body: unknown, status = 200, additionalHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...additionalHeaders,
    },
  });
}
