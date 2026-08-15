import "server-only"

import { ApiError } from "@/lib/api-guards"
import { normalizeDomainHost, isPlatformHost } from "@/lib/custom-domain-routing"
import { prisma } from "@/lib/db"
import type { NextRequest } from "next/server"
import { normalizePushOrigin } from "@/lib/push-origin"

/** Allows configured platform origins or an ACTIVE custom domain owned by the tenant. */
export async function requirePushOriginForOrganization(organizationId: string, value: string) {
  let origin: string
  try {
    origin = normalizePushOrigin(value)
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : "Push origin is invalid")
  }
  const hostname = normalizeDomainHost(new URL(origin).hostname)

  if (isPlatformHost(hostname)) return origin

  const domain = await prisma.organizationDomain.findFirst({
    where: {
      organizationId,
      normalizedDomain: hostname,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!domain) throw new ApiError(403, "Push origin is not registered for this organization")

  return origin
}

export function getRequestPushOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "") || "https"
  return `${protocol}://${host}`
}
