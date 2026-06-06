"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  signIn as signInAuth,
  signOut as signOutAuth,
  useSession,
} from "next-auth/react"
import { type OrganizationType, type UserRole } from "@/lib/types"
import {
  checkRouteAccess,
  getRedirectPathForRole,
  type AccessCheckResult,
  type UserAccessContext,
} from "@/lib/access-control"

const SUPPORTED_LOCALES = ["fa", "en", "ar"] as const

type Locale = (typeof SUPPORTED_LOCALES)[number]

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  locale: string
  theme: string
  isTeamMember: boolean
  isActive: boolean
}

export interface OrganizationMembership {
  id: string
  role: UserRole
  organizationId: string
  organizationName: string
  organizationSlug: string
  organizationType: OrganizationType
  isActive: boolean
}

export interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasPermission: (permission: string) => boolean
  organizationMembership: OrganizationMembership | null
  accessContext: UserAccessContext | null
  checkAccess: (route: string) => AccessCheckResult
  hasRouteAccess: (route: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getLocaleFromPathname(pathname: string): Locale {
  const firstSegment = pathname.split("/").filter(Boolean)[0]
  return SUPPORTED_LOCALES.includes(firstSegment as Locale) ? (firstSegment as Locale) : "fa"
}

function withLocalePath(path: string, locale: Locale): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const firstSegment = normalizedPath.split("/").filter(Boolean)[0]
  if (SUPPORTED_LOCALES.includes(firstSegment as Locale)) {
    return normalizedPath
  }

  return `/${locale}${normalizedPath}`
}

function getCallbackUrlFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl")
  if (!callbackUrl || /^https?:\/\//i.test(callbackUrl)) {
    return null
  }

  return callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [organizationMembership, setOrganizationMembership] = useState<OrganizationMembership | null>(null)

  const isLoading = status === "loading"
  const locale = getLocaleFromPathname(pathname)

  const fetchOrganizationMembership = useCallback(async () => {
    try {
      const response = await fetch("/api/users/me/membership", { cache: "no-store" })
      if (!response.ok) {
        setOrganizationMembership(null)
        return
      }

      const data = (await response.json()) as { membership?: OrganizationMembership | null }
      setOrganizationMembership(data.membership ?? null)
    } catch (error) {
      console.error("Error fetching organization membership:", error)
      setOrganizationMembership(null)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      void fetchOrganizationMembership()
      return
    }

    setOrganizationMembership(null)
  }, [fetchOrganizationMembership, session?.user?.id, status])

  const authUser: AuthUser | null = useMemo(() => {
    if (!session?.user) {
      return null
    }

    return {
      id: String(session.user.id ?? ""),
      email: String(session.user.email ?? ""),
      name: String(session.user.name ?? ""),
      role: (session.user.role as UserRole | undefined) ?? "CUSTOMER",
      locale: String(session.user.locale ?? locale),
      theme: String(session.user.theme ?? "system"),
      isTeamMember: Boolean(session.user.isTeamMember),
      isActive: true,
    }
  }, [locale, session?.user])

  const accessContext: UserAccessContext | null = useMemo(() => {
    if (!authUser) {
      return null
    }

    return {
      userId: authUser.id,
      userRole: authUser.role,
      organizationId: organizationMembership?.organizationId,
      organizationType: organizationMembership?.organizationType,
    }
  }, [authUser, organizationMembership])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const result = await signInAuth("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      router.push(getCallbackUrlFromLocation() ?? `/${locale}/dashboard`)
      router.refresh()
    },
    [locale, router],
  )

  const signOut = useCallback(async () => {
    await signOutAuth({ redirect: false })
    setOrganizationMembership(null)
    router.push(`/${locale}/login`)
    router.refresh()
  }, [locale, router])

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!authUser) return false

      const rolePermissions: Record<UserRole, string[]> = {
        SUPER_ADMIN: [
          "org:create", "org:read", "org:update", "org:delete",
          "org:manage_members", "org:manage_hours",
          "service:create", "service:read", "service:update", "service:delete",
          "product:create", "product:read", "product:update", "product:delete",
          "order:read", "order:update", "order:assign_driver", "order:manage",
          "appointment:read", "appointment:create", "appointment:update", "appointment:cancel",
          "review:create", "review:manage", "user:manage",
          "settings:manage", "promotion:manage", "payment:manage",
        ],
        ADMIN: [
          "org:read", "org:update",
          "org:manage_members", "org:manage_hours",
          "service:create", "service:read", "service:update", "service:delete",
          "product:create", "product:read", "product:update", "product:delete",
          "order:read", "order:update", "order:assign_driver", "order:manage",
          "appointment:read", "appointment:create", "appointment:update", "appointment:cancel",
          "review:manage", "settings:manage", "promotion:manage", "payment:manage",
        ],
        MANAGER: [
          "org:read",
          "service:create", "service:read", "service:update",
          "product:create", "product:read", "product:update",
          "order:read", "order:update",
          "appointment:read", "appointment:create", "appointment:update",
          "settings:manage",
        ],
        STAFF: [
          "org:read",
          "service:read",
          "product:read",
          "order:read", "order:update",
          "appointment:read", "appointment:update",
        ],
        DRIVER: ["org:read", "order:read", "order:update"],
        CUSTOMER: [
          "org:read",
          "service:read",
          "product:read",
          "order:read", "order:create",
          "appointment:read", "appointment:create", "appointment:cancel",
          "review:create",
        ],
        GUEST: [
          "org:read",
          "service:read",
          "product:read",
          "order:read", "order:create",
          "appointment:read", "appointment:create", "appointment:cancel",
          "review:create",
        ],
      }

      return rolePermissions[authUser.role]?.includes(permission) ?? false
    },
    [authUser],
  )

  const checkAccess = useCallback(
    (route: string): AccessCheckResult => {
      if (!accessContext) {
        return {
          hasAccess: false,
          reason: "User not authenticated",
          redirectPath: `/${locale}/login`,
        }
      }

      return checkRouteAccess(route, accessContext)
    },
    [accessContext, locale],
  )

  const hasRouteAccess = useCallback(
    (route: string): boolean => checkAccess(route).hasAccess,
    [checkAccess],
  )

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        isLoading,
        isAuthenticated: status === "authenticated" && Boolean(authUser),
        signIn,
        signOut,
        hasPermission,
        organizationMembership,
        accessContext,
        checkAccess,
        hasRouteAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function useHasRole(roles: UserRole | UserRole[]) {
  const { user } = useAuth()
  if (!user) return false

  const roleArray = Array.isArray(roles) ? roles : [roles]
  return roleArray.includes(user.role)
}

export function useProtectedRoute(redirectTo: string = "/login") {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const localizedRedirect = withLocalePath(redirectTo, locale)
      router.push(`${localizedRedirect}?callbackUrl=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, isAuthenticated, locale, pathname, redirectTo, router])

  return { isLoading, isAuthenticated }
}

export function useDashboardAccess() {
  const { isAuthenticated, isLoading, accessContext, checkAccess } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)

  const accessCheck = useMemo(() => {
    if (!isAuthenticated) {
      return {
        hasAccess: false,
        reason: "User not authenticated",
        redirectPath: `/${locale}/login`,
      } satisfies AccessCheckResult
    }

    return checkAccess(pathname)
  }, [checkAccess, isAuthenticated, locale, pathname])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated) {
      router.push(`/${locale}/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }

    if (!accessCheck.hasAccess && accessCheck.redirectPath) {
      router.push(withLocalePath(accessCheck.redirectPath, locale))
    }
  }, [accessCheck.hasAccess, accessCheck.redirectPath, isAuthenticated, isLoading, locale, pathname, router])

  return {
    isLoading,
    isAuthenticated,
    accessContext,
    hasAccess: accessCheck.hasAccess,
    reason: accessCheck.reason,
  }
}

export function useOrganizationContext() {
  const { organizationMembership } = useAuth()

  return {
    organization: organizationMembership
      ? {
          id: organizationMembership.organizationId,
          name: organizationMembership.organizationName,
          slug: organizationMembership.organizationSlug,
          type: organizationMembership.organizationType,
        }
      : null,
    membership: organizationMembership,
    isLoading: false,
  }
}

export function useAccessCheck(route: string) {
  const { checkAccess, isLoading, isAuthenticated } = useAuth()
  const accessResult = checkAccess(route)

  return {
    hasAccess: accessResult.hasAccess,
    reason: accessResult.reason,
    redirectPath: accessResult.redirectPath,
    isLoading,
    isAuthenticated,
  }
}

export function useFilteredNavItems<T extends { requiredRoles?: UserRole[]; requiredOrgType?: OrganizationType[]; requiresOrgMembership?: boolean; isUniversal?: boolean }>(
  items: T[],
): T[] {
  const { accessContext, isAuthenticated } = useAuth()

  if (!isAuthenticated || !accessContext) {
    return items.filter((item) => item.isUniversal)
  }

  return items.filter((item) => {
    if (item.isUniversal) {
      return true
    }

    if (accessContext.userRole === "SUPER_ADMIN") {
      return true
    }

    if (item.requiredRoles && !item.requiredRoles.includes(accessContext.userRole)) {
      return false
    }

    if (item.requiresOrgMembership && !accessContext.organizationId) {
      return false
    }

    if (item.requiredOrgType) {
      if (!accessContext.organizationType) {
        return false
      }
      if (!item.requiredOrgType.includes(accessContext.organizationType)) {
        return false
      }
    }

    return true
  })
}
