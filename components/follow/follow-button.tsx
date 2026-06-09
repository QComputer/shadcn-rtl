"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { getDictionary, getDictValue } from "@/lib/dictionary"

type FollowButtonLabels = {
  follow: string
  following: string
  loginToFollow: string
  error: string
}

interface FollowButtonProps {
  organizationId: string
  initialFollowing?: boolean
  locale?: string
  className?: string
  labels?: Partial<FollowButtonLabels>
  onToggle?: (following: boolean) => void
}

function getLabels(locale: string | undefined, overrides?: Partial<FollowButtonLabels>) {
  const dict = getDictionary(locale || "fa")
  const base = {
    follow: getDictValue(dict, "organization.follow"),
    following: getDictValue(dict, "organization.following"),
    loginToFollow: getDictValue(dict, "organization.loginToFollow"),
    error: getDictValue(dict, "organization.followUpdateError"),
  }

  return { ...base, ...overrides }
}

export function FollowButton({ 
  organizationId, 
  initialFollowing = false,
  locale = "fa",
  className,
  labels: labelOverrides,
  onToggle 
}: FollowButtonProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labels = useMemo(() => getLabels(locale, labelOverrides), [locale, labelOverrides])

  if (!user) {
    const loginHref = `/${locale}/login?callbackUrl=${encodeURIComponent(pathname || `/${locale}`)}`
    return (
      <Link
        href={loginHref}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
      >
        <Heart className="h-4 w-4 ms-1" aria-hidden="true" />
        {labels.loginToFollow}
      </Link>
    )
  }

  const handleToggle = async () => {
    setLoading(true)
    setError(null)
    const nextFollowing = !isFollowing
    
    try {
      const method = isFollowing ? "DELETE" : "POST"
      const response = await fetch(`/api/organizations/${organizationId}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error(labels.error)
      }

      setIsFollowing(nextFollowing)
      onToggle?.(nextFollowing)
    } catch (err) {
      console.error("Follow error:", err)
      setError(labels.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        aria-pressed={isFollowing}
        className={className}
      >
        <Heart
          className={cn("h-4 w-4 ms-1", isFollowing && "fill-current")}
          aria-hidden="true"
        />
        {isFollowing ? labels.following : labels.follow}
      </Button>
      {error && (
        <span className="text-xs text-destructive" role="status">
          {error}
        </span>
      )}
    </span>
  )
}
