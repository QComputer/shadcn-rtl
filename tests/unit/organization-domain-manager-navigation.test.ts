import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { checkRouteAccess, effectiveDashboardRole } from "@/lib/access-control"
import { getDashboardRouteAccessDecision } from "@/lib/dashboard/navigation-policy"
import { organizationDomainCheckRequest, organizationDomainsHref } from "@/lib/domains/organization-domain-manager"

const organizationId = "cmvbltspu0000jt08zfn7xltj"
const domainId = "cmvblttif000fjt085yf5712p"

describe("platform organization domain navigation and Check flow", () => {
  it("links the organization row to the locale-aware scoped manager", () => {
    assert.equal(
      organizationDomainsHref("fa", organizationId),
      `/fa/dashboard/settings/domains?organizationId=${organizationId}`,
    )
    const organizationsPage = readFileSync("app/[locale]/dashboard/organizations/page.tsx", "utf8")
    assert.match(organizationsPage, /href=\{organizationDomainsHref\(locale, organization\.id\)\}/)
  })

  it("does not downgrade global SUPER_ADMIN access because of a selected org membership", () => {
    const effectiveRole = effectiveDashboardRole("SUPER_ADMIN", "MANAGER")
    assert.equal(effectiveRole, "SUPER_ADMIN")
    const decision = checkRouteAccess(`/fa/dashboard/settings/domains`, {
      userId: "platform-operator",
      userRole: effectiveRole,
      organizationId: undefined,
    })
    assert.equal(decision.hasAccess, true)
    assert.equal(decision.redirectPath, undefined)
    const clientBoundary = getDashboardRouteAccessDecision({
      locale: "fa",
      pathname: `/fa/dashboard/settings/domains`,
      role: effectiveRole,
    })
    assert.equal(clientBoundary.isKnownRoute, true)
    assert.equal(clientBoundary.isAllowed, true)
  })

  it("allows scoped organization managers but keeps the route behind membership authorization", () => {
    assert.equal(checkRouteAccess("/fa/dashboard/settings/domains", {
      userId: "hotel-manager",
      userRole: "MANAGER",
      organizationId,
    }).hasAccess, true)
    const noMembership = checkRouteAccess("/fa/dashboard/settings/domains", {
      userId: "unscoped-manager",
      userRole: "MANAGER",
    })
    assert.equal(noMembership.hasAccess, false)
    assert.equal(noMembership.redirectPath, "/dashboard/settings")
  })

  it("sends Check to the audited OrganizationDomain API, never the Shop-only API", () => {
    const request = organizationDomainCheckRequest(domainId)
    assert.equal(request.url, `/api/dashboard/organization-domains/${domainId}/vercel`)
    assert.equal(request.init.method, "POST")
    assert.deepEqual(JSON.parse(String(request.init.body)), { action: "check" })

    const managerPage = readFileSync("app/[locale]/dashboard/settings/domains/page.tsx", "utf8")
    assert.match(managerPage, /organizationDomainCheckRequest\(domain\.id\)/)
    const organizationApi = readFileSync("app/api/dashboard/organization-domains/[domainId]/vercel/route.ts", "utf8")
    assert.match(organizationApi, /assertDomainOwnership/)
    assert.match(organizationApi, /if \(action === "check"\) return inspectProjectDomainOnVercel\(domain\)/)
    assert.match(organizationApi, /writeAuditLog\(/)

    const shopManager = readFileSync("components/dashboard/shop-domain-manager.tsx", "utf8")
    assert.match(shopManager, /\/api\/dashboard\/shop-domains\/\$\{domainId\}\/vercel/)
    assert.match(readFileSync("app/api/dashboard/shop-domains/[domainId]/vercel/route.ts", "utf8"), /Only shop domains can be synced with Vercel from this tool/)
  })
})
