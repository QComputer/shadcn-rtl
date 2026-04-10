"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { 
  signIn as signInAuth, 
  signOut as signOutAuth, 
  useSession,
} from "next-auth/react"
import { type UserRole, type OrganizationType } from "@/lib/types"
import { checkRouteAccess, type UserAccessContext, type AccessCheckResult} from "@/lib/access-control"


export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: string;
  theme: string;
  isTeamMember: boolean;
  isActive: boolean;
}

export interface OrganizationMembership {
  id: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationType: OrganizationType;
  isActive: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  // New access control methods
  organizationMembership: OrganizationMembership | null;
  accessContext: UserAccessContext | null;
  checkAccess: (route: string) => AccessCheckResult;
  hasRouteAccess: (route: string) => boolean;
}

export interface OrganizationMembership {
  id: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationType: OrganizationType;
  isActive: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  // New access control methods
  organizationMembership: OrganizationMembership | null;
  accessContext: UserAccessContext | null;
  checkAccess: (route: string) => AccessCheckResult;
  hasRouteAccess: (route: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [organizationMembership, setOrganizationMembership] = useState<OrganizationMembership | null>(null)

  useEffect(() => {
    // Set loading state based on auth status
    setIsLoading(status === "loading")
  }, [status])

  // Fetch organization membership when user is authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchOrganizationMembership()
    } else {
      setOrganizationMembership(null)
    }
  }, [status, session?.user?.id])

  const fetchOrganizationMembership = async () => {
    try {
      const response = await fetch("/api/users/me/membership")
      if (response.ok) {
        const data = await response.json()
        setOrganizationMembership(data.membership)
      }
    } catch (error) {
      console.error("Error fetching organization membership:", error)
      setOrganizationMembership(null)
    }
  }

  const authUser: AuthUser | null = session?.user ? {
    id: session.user.id as string,
    email: session.user.email as string,
    name: session.user.name as string,
    role: session.user.role as UserRole,
    locale: session.user.locale as string,
    theme: session.user.theme as string,
    isTeamMember: session.user.isTeamMember as boolean,
    isActive: true,
  } : null

  // Build access context for permission checks
  const accessContext: UserAccessContext | null = authUser ? {
    userId: authUser.id,
    userRole: authUser.role,
    organizationId: organizationMembership?.organizationId,
    organizationType: organizationMembership?.organizationType,
    //orgMemberRole: organizationMembership?.role,
  } : null

  const signIn = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await signInAuth("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("Sign in error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      await signOutAuth({ redirect: false })
      //console.log('session.user:', session?.user)
      router.push("/")
    } catch (error) {
      console.error("Sign out error:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const hasPermission = (permission: string): boolean => {
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
        "settings:manage", "promotion:manage", "payment:manage"
      ],
      ADMIN: [
        "org:read", "org:update",
        "org:manage_members", "org:manage_hours",
        "service:create", "service:read", "service:update", "service:delete",
        "product:create", "product:read", "product:update", "product:delete",
        "order:read", "order:update", "order:assign_driver", "order:manage",
        "appointment:read", "appointment:create", "appointment:update", "appointment:cancel",
        "review:manage", "settings:manage", "promotion:manage", "payment:manage"
      ],
      MANAGER: [
        "org:read",
        "service:create", "service:read", "service:update",
        "product:create", "product:read", "product:update",
        "order:read", "order:update",
        "appointment:read", "appointment:create", "appointment:update",
        "settings:manage"
      ],
      STAFF: [
        "org:read",
        "service:read",
        "product:read",
        "order:read", "order:update",
        "appointment:read", "appointment:update"
      ],
      DRIVER: [
        "org:read",
        "order:read", "order:update"
      ],
      CUSTOMER: [
        "org:read",
        "service:read",
        "product:read",
        "order:read", "order:create",
        "appointment:read", "appointment:create", "appointment:cancel",
        "review:create"
      ],
      GUEST: [
        "org:read",
        "service:read",
        "product:read",
        "order:read", "order:create",
        "appointment:read", "appointment:create", "appointment:cancel",
        "review:create"
      ]
    }

    return rolePermissions[authUser.role]?.includes(permission) ?? false
  }

  // Check access for a specific route
  const checkAccess = (route: string): AccessCheckResult => {
    if (!accessContext) {
      return {
        hasAccess: false,
        reason: "User not authenticated",
        redirectPath: "/login",
      }
    }
    return checkRouteAccess(route, accessContext)
  }

  // Simple boolean check for route access
  const hasRouteAccess = (route: string): boolean => {
    return checkAccess(route).hasAccess
  }

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        isLoading,
        isAuthenticated: !!authUser,
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

// Hook for checking if user has specific role
export function useHasRole(roles: UserRole | UserRole[]) {
  const { user } = useAuth()
  
  if (!user) return false
  
  const roleArray = Array.isArray(roles) ? roles : [roles]
  return roleArray.includes(user.role)
}

// Hook for protected routes
export function useProtectedRoute(redirectTo: string = "/login") {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`${redirectTo}?callbackUrl=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, isAuthenticated, router, pathname, redirectTo])

  return { isLoading, isAuthenticated }
}

// Hook for dashboard access control
export function useDashboardAccess() {
  const { isAuthenticated, isLoading, accessContext, checkAccess, hasRouteAccess } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const accessCheck = checkAccess(pathname)
      if (!accessCheck.hasAccess && accessCheck.redirectPath) {
        router.push(accessCheck.redirectPath)
      }
    }
  }, [isLoading, isAuthenticated, pathname, checkAccess, router])

  return {
    isLoading,
    isAuthenticated,
    accessContext,
    hasAccess: isAuthenticated ? checkAccess(pathname).hasAccess : false,
  }
}

// Hook for organization context
export function useOrganizationContext() {
  const { organizationMembership, accessContext } = useAuth()
  
  return {
    organization: organizationMembership ? {
      id: organizationMembership.organizationId,
      name: organizationMembership.organizationName,
      slug: organizationMembership.organizationSlug,
      type: organizationMembership.organizationType,
    } : null,
    membership: organizationMembership,
    isLoading: false,
  }
}

// Hook for checking specific access permissions
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

// Hook for navigation items filtering
export function useFilteredNavItems<T extends { requiredRoles?: UserRole[]; requiredOrgType?: OrganizationType[]; isUniversal?: boolean }>(
  items: T[]
): T[] {
  const { accessContext, isAuthenticated } = useAuth()
  
  if (!isAuthenticated || !accessContext) {
    return items.filter(item => item.isUniversal)
  }
  
  return items.filter((item) => {
    // Universal items are always visible
    if (item.isUniversal) {
      return true
    }

    // SUPER_ADMIN sees everything
    if (accessContext.userRole === "SUPER_ADMIN") {
      return true
    }

    // Check role requirement
    if (item.requiredRoles && !item.requiredRoles.includes(accessContext.userRole)) {
      return false
    }

    // Check org type requirement
    if (item.requiredOrgType && accessContext.organizationType) {
      if (!item.requiredOrgType.includes(accessContext.organizationType)) {
        return false
      }
    }

    // Check org member role requirement
    //if (item.requiredOrgMemberRole && accessContext.orgMemberRole) {
    //  if (!item.requiredOrgMemberRole.includes(accessContext.orgMemberRole)) {
    //    return false
    //  }
    //}

    return true
  })
}
