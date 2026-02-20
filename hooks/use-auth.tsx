"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { 
  signIn as signInAuth, 
  signOut as signOutAuth, 
  useSession,
} from "next-auth/react"
import { type UserRole } from "@/lib/types"

interface AuthUser {
  id: string
  email: string
  name?: string
  role: UserRole
  locale: string
  theme: string
  isTeamMember: boolean
  isActive: boolean
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set loading state based on auth status
    setIsLoading(status === "loading")
  }, [status])

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

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await signInAuth("credentials", {
        email,
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
      router.push("/login")
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
      ]
    }

    return rolePermissions[authUser.role]?.includes(permission) ?? false
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
