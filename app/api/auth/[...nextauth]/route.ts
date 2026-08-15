import { handlers } from "@/lib/auth"
import {
  getCustomDomainRequestOrigin,
  rewriteAuthHtmlForCustomDomain,
  rewriteAuthJsonForCustomDomain,
  rewriteAuthLocationForCustomDomain,
} from "@/lib/custom-domain-auth"
import { NextRequest } from "next/server"

function withRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host")
  if (!host) return request

  const url = new URL(request.url)
  url.host = host
  url.protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol

  return new NextRequest(url, request)
}

async function normalizeCustomDomainResponse(response: Response, request: NextRequest) {
  const customOrigin = getCustomDomainRequestOrigin(request)
  if (!customOrigin) return response

  const headers = new Headers(response.headers)
  const location = headers.get("location")
  if (location) {
    headers.set("location", rewriteAuthLocationForCustomDomain(location, customOrigin))
  }

  if (headers.get("content-type")?.includes("application/json")) {
    const json = rewriteAuthJsonForCustomDomain(await response.text(), customOrigin)
    headers.delete("content-length")
    return new Response(json, { status: response.status, statusText: response.statusText, headers })
  }

  if (!headers.get("content-type")?.includes("text/html")) {
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }

  const html = rewriteAuthHtmlForCustomDomain(await response.text(), customOrigin)
  headers.delete("content-length")
  return new Response(html, { status: response.status, statusText: response.statusText, headers })
}

export async function GET(request: NextRequest) {
  return normalizeCustomDomainResponse(await handlers.GET(withRequestOrigin(request)), request)
}

export async function POST(request: NextRequest) {
  return normalizeCustomDomainResponse(await handlers.POST(withRequestOrigin(request)), request)
}
