"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface FollowButtonProps {
  organizationId: string
  initialFollowing?: boolean
  onToggle?: (following: boolean) => void
}

export function FollowButton({ 
  organizationId, 
  initialFollowing = false,
  onToggle 
}: FollowButtonProps) {
  const { user } = useAuth()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const handleToggle = async () => {
    setLoading(true)
    
    try {
      const method = isFollowing ? "DELETE" : "POST"
      const response = await fetch(`/api/organizations/${organizationId}/follow`, {
        method,
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
        onToggle?.(!isFollowing)
      }
    } catch (err) {
      console.error("Follow error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      <Heart className={`h-4 w-4 mr-1 ${isFollowing ? "" : "fill-current"}`} />
      {isFollowing ? "دنبال شده" : "دنبال کردن"}
    </Button>
  )
}