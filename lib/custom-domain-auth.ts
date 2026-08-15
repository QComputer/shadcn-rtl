import { isPlatformHost, normalizeDomainHost } from "@/lib/custom-domain-routing"

export function getCustomDomainRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host")
  if (!host || isPlatformHost(normalizeDomainHost(host))) return null

  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol
  return `${protocol.replace(/:$/, "")}://${host}`
}

export function rewriteAuthLocationForCustomDomain(location: string, customOrigin: string) {
  const target = new URL(location, customOrigin)
  if (!isPlatformHost(target.hostname)) return location

  const origin = new URL(customOrigin)
  target.protocol = origin.protocol
  target.host = origin.host
  return target.toString()
}

export function rewriteAuthHtmlForCustomDomain(html: string, customOrigin: string) {
  return html.replace(
    /(action=["'])https?:\/\/[^/"']+(\/api\/auth\/[^"']*)(["'])/gi,
    `$1${customOrigin}$2$3`,
  )
}

export function rewriteAuthJsonForCustomDomain(body: string, customOrigin: string) {
  try {
    const value = JSON.parse(body) as { url?: unknown }
    if (typeof value.url === "string") {
      value.url = rewriteAuthLocationForCustomDomain(value.url, customOrigin)
    }
    return JSON.stringify(value)
  } catch {
    return body
  }
}
