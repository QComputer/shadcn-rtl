"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type ManageableMemberRole = "ADMIN" | "MANAGER" | "STAFF" | "DRIVER"
type MemberStatusValue = "active" | "inactive"

interface User {
  id: string
  name?: string | null
  role?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  avatar?: string | null
  isActive?: boolean
}

interface Member {
  id: string
  organizationId: string
  role: ManageableMemberRole
  isActive: boolean
  joinedAt: string
  user: User
}

const roleConfig: Record<ManageableMemberRole, { label: string; icon: typeof UserCog; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  ADMIN: { label: "ادمین", icon: ShieldCheck, badge: "secondary" },
  MANAGER: { label: "مدیر", icon: UserCog, badge: "default" },
  STAFF: { label: "کارمند", icon: Users, badge: "outline" },
  DRIVER: { label: "پیک", icon: Truck, badge: "outline" },
}

function getDisplayName(user: User) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email || "عضو بدون نام"
}

function getInitials(user: User) {
  const displayName = getDisplayName(user).trim()
  return displayName.slice(0, 1).toUpperCase() || "؟"
}

function statusToValue(isActive: boolean): MemberStatusValue {
  return isActive ? "active" : "inactive"
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function OrganizationMembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"

  const [searchQuery, setSearchQuery] = useState("")
  const [members, setMembers] = useState<Member[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  const t = useCallback(
    (key: string): string => {
      if (!dict) return key
      return getDictValue(dict, key)
    },
    [dict],
  )

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    setError(null)

    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) {
      throw new Error(await readError(membershipResponse, "Failed to fetch membership"))
    }

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error("No active organization membership")

    const membersResponse = await appFetch(`/api/organizations/${orgId}/members`, { cache: "no-store", signal })
    if (!membersResponse.ok) {
      throw new Error(await readError(membersResponse, "Failed to fetch members"))
    }

    const nextMembers = await membersResponse.json()
    setOrganizationId(orgId)
    setMembers(Array.isArray(nextMembers) ? nextMembers : [])
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetchMembers(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to fetch members")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [fetchMembers])

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return members

    return members.filter((member) => {
      const roleLabel = roleConfig[member.role]?.label || member.role
      const searchable = [
        getDisplayName(member.user),
        member.user.email,
        member.user.phone,
        member.role,
        roleLabel,
        member.isActive ? "active فعال" : "inactive غیرفعال غیر فعال",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [members, searchQuery])

  const activeCount = useMemo(() => members.filter((member) => member.isActive).length, [members])

  const refreshMembers = async () => {
    setRefreshing(true)
    try {
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh members")
    } finally {
      setRefreshing(false)
    }
  }

  const updateMember = async (memberId: string, body: { role?: ManageableMemberRole; isActive?: boolean }) => {
    if (!organizationId) {
      setError("No active organization membership")
      return
    }

    setUpdating(true)
    setError(null)
    try {
      const response = await appFetch(`/api/organizations/${organizationId}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(await readError(response, "Failed to update organization member"))
      }

      await fetchMembers()
      setSelectedMember(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization member")
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateRole = (memberId: string, newRole: string) => {
    updateMember(memberId, { role: newRole as ManageableMemberRole })
  }

  const handleUpdateIsActive = (memberId: string, isActive: string) => {
    updateMember(memberId, { isActive: isActive === "active" })
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-10 w-1/3 rounded bg-muted" />
        <div className="grid gap-3">
          {[1, 2, 3].map((item) => (
            <div key={`${locale}-member-skeleton-${item}`} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{t("navigation.members") || "اعضا"}</h2>
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(members.length.toString())} عضو، {toPersianDigits(activeCount.toString())} فعال
          </p>
        </div>
        <Button variant="outline" onClick={refreshMembers} disabled={refreshing || updating}>
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          تازه‌سازی
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="جستجوی نام، ایمیل، تلفن، نقش یا وضعیت..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pr-10"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3">
        {filteredMembers.map((member) => {
          const role = roleConfig[member.role] || roleConfig.STAFF
          const RoleIcon = role.icon
          const displayName = getDisplayName(member.user)

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => setSelectedMember(member)}
              className="rounded-xl border bg-card p-3 text-start shadow-sm transition hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user.avatar || undefined} alt={displayName} />
                    <AvatarFallback>{getInitials(member.user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{displayName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {member.user.email && (
                        <span className="ltr truncate" dir="ltr">
                          {member.user.email}
                        </span>
                      )}
                      {member.user.phone && <span>{member.user.phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Badge variant={role.badge} className="gap-1">
                    <RoleIcon className="h-3.5 w-3.5" />
                    {role.label}
                  </Badge>
                  <Badge variant={member.isActive ? "default" : "destructive"}>
                    {member.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {filteredMembers.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            عضوی با این جستجو پیدا نشد.
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        نمایش {toPersianDigits(filteredMembers.length.toString())} از {toPersianDigits(members.length.toString())} عضو
      </p>

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مدیریت عضو</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedMember.user.avatar || undefined} alt={getDisplayName(selectedMember.user)} />
                      <AvatarFallback>{getInitials(selectedMember.user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{getDisplayName(selectedMember.user)}</CardTitle>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant={roleConfig[selectedMember.role]?.badge || "outline"}>
                          {roleConfig[selectedMember.role]?.label || selectedMember.role}
                        </Badge>
                        <Badge variant={selectedMember.isActive ? "default" : "destructive"}>
                          {selectedMember.isActive ? "فعال" : "غیرفعال"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {selectedMember.user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="ltr" dir="ltr">
                        {selectedMember.user.email}
                      </span>
                    </div>
                  )}
                  {selectedMember.user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{selectedMember.user.phone}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">نقش سازمانی</label>
                  <Select
                    value={selectedMember.role}
                    onValueChange={(value) => handleUpdateRole(selectedMember.id, value)}
                    disabled={updating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">وضعیت عضویت</label>
                  <Select
                    value={statusToValue(selectedMember.isActive)}
                    onValueChange={(value) => handleUpdateIsActive(selectedMember.id, value)}
                    disabled={updating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                برای جلوگیری از قفل شدن پنل، API اجازه غیرفعال‌کردن یا تغییر نقش آخرین ادمین فعال سازمان را نمی‌دهد.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
