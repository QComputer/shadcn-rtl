"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BarChart3, Bell, Coins, Crown, Gift, RefreshCw, Search, UserRoundCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type MembershipStatus = "ACTIVE" | "PAUSED" | "LEFT" | "BLOCKED"
type MembershipTier = "MEMBER" | "LOYAL" | "VIP"

type CustomerClubMember = {
  id: string
  organizationId: string
  customerId: string
  status: MembershipStatus
  tier: MembershipTier
  source: string
  joinedAt: string
  leftAt?: string | null
  customer: {
    id: string
    name?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    avatar?: string | null
    image?: string | null
    isActive?: boolean | null
  }
}

type CustomerClubCopy = {
  title: string
  subtitle: string
  members: string
  activeMembers: string
  searchPlaceholder: string
  refresh: string
  loading: string
  emptyTitle: string
  emptyDescription: string
  errorTitle: string
  customer: string
  status: string
  tier: string
  source: string
  joinedAt: string
  manageMember: string
  updateHint: string
  noContact: string
  showing: string
  segments?: string
  loyalty?: string
  coupons?: string
  push?: string
  statuses: Record<MembershipStatus, string>
  tiers: Record<MembershipTier, string>
}

const fallbackCopy: Record<string, CustomerClubCopy> = {
  fa: {
    title: "باشگاه مشتریان",
    subtitle: "اعضای باشگاه مشتریان این سازمان را مدیریت کنید.",
    members: "اعضا",
    activeMembers: "عضو فعال",
    searchPlaceholder: "جستجوی نام، ایمیل، تلفن، وضعیت یا سطح...",
    refresh: "تازه‌سازی",
    loading: "در حال بارگذاری باشگاه مشتریان...",
    emptyTitle: "هنوز عضوی در باشگاه مشتریان نیست",
    emptyDescription: "عضویت‌های مشتریان پس از پیوستن یا افزودن توسط مدیر اینجا نمایش داده می‌شود.",
    errorTitle: "بارگذاری باشگاه مشتریان ناموفق بود",
    customer: "مشتری",
    status: "وضعیت",
    tier: "سطح",
    source: "منبع",
    joinedAt: "تاریخ عضویت",
    manageMember: "مدیریت عضو",
    updateHint: "تغییر وضعیت یا سطح فقط روی عضویت باشگاه همین سازمان اعمال می‌شود.",
    noContact: "اطلاعات تماس ثبت نشده",
    showing: "نمایش",
    statuses: {
      ACTIVE: "فعال",
      PAUSED: "متوقف",
      LEFT: "خارج شده",
      BLOCKED: "مسدود",
    },
    tiers: {
      MEMBER: "عضو",
      LOYAL: "وفادار",
      VIP: "ویژه",
    },
  },
  en: {
    title: "Customer Club",
    subtitle: "Manage this organization's customer club members.",
    members: "Members",
    activeMembers: "active members",
    searchPlaceholder: "Search name, email, phone, status, or tier...",
    refresh: "Refresh",
    loading: "Loading customer club...",
    emptyTitle: "No customer club members yet",
    emptyDescription: "Customer memberships will appear here after customers join or managers add them.",
    errorTitle: "Customer club could not be loaded",
    customer: "Customer",
    status: "Status",
    tier: "Tier",
    source: "Source",
    joinedAt: "Joined",
    manageMember: "Manage member",
    updateHint: "Status and tier changes apply only to this organization's customer club membership.",
    noContact: "No contact details",
    showing: "Showing",
    statuses: {
      ACTIVE: "Active",
      PAUSED: "Paused",
      LEFT: "Left",
      BLOCKED: "Blocked",
    },
    tiers: {
      MEMBER: "Member",
      LOYAL: "Loyal",
      VIP: "VIP",
    },
  },
  ar: {
    title: "نادي العملاء",
    subtitle: "إدارة أعضاء نادي العملاء لهذه المؤسسة.",
    members: "الأعضاء",
    activeMembers: "أعضاء نشطون",
    searchPlaceholder: "ابحث بالاسم أو البريد أو الهاتف أو الحالة أو المستوى...",
    refresh: "تحديث",
    loading: "جار تحميل نادي العملاء...",
    emptyTitle: "لا يوجد أعضاء في نادي العملاء بعد",
    emptyDescription: "ستظهر عضويات العملاء هنا بعد الانضمام أو الإضافة من المدير.",
    errorTitle: "تعذر تحميل نادي العملاء",
    customer: "العميل",
    status: "الحالة",
    tier: "المستوى",
    source: "المصدر",
    joinedAt: "تاريخ الانضمام",
    manageMember: "إدارة العضو",
    updateHint: "تغييرات الحالة والمستوى تطبق فقط على عضوية نادي هذه المؤسسة.",
    noContact: "لا توجد بيانات اتصال",
    showing: "عرض",
    statuses: {
      ACTIVE: "نشط",
      PAUSED: "متوقف",
      LEFT: "غادر",
      BLOCKED: "محظور",
    },
    tiers: {
      MEMBER: "عضو",
      LOYAL: "وفي",
      VIP: "مميز",
    },
  },
}

function getDisplayName(member: CustomerClubMember) {
  const user = member.customer
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email || user.phone || "Customer"
}

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function CustomerClubMembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<CustomerClubCopy>(fallbackCopy[locale] ?? fallbackCopy.fa)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [members, setMembers] = useState<CustomerClubMember[]>([])
  const [query, setQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<CustomerClubMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const customerClub = dict.customerClub
    if (customerClub && typeof customerClub === "object") {
      setCopy(customerClub as CustomerClubCopy)
    } else {
      setCopy(fallbackCopy[locale] ?? fallbackCopy.fa)
    }
  }, [locale])

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    setError(null)

    const membershipResponse = await fetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) {
      throw new Error(await readError(membershipResponse, "Failed to load organization membership"))
    }

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error("No active organization membership")

    const membersResponse = await fetch(`/api/dashboard/customer-club/members?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!membersResponse.ok) {
      throw new Error(await readError(membersResponse, "Failed to load customer club members"))
    }

    const data = await membersResponse.json()
    setOrganizationId(orgId)
    setMembers(Array.isArray(data?.members) ? data.members : [])
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetchMembers(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [copy.errorTitle, fetchMembers])

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return members

    return members.filter((member) => {
      const searchable = [
        getDisplayName(member),
        member.customer.email,
        member.customer.phone,
        member.status,
        copy.statuses[member.status],
        member.tier,
        copy.tiers[member.tier],
        member.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(normalizedQuery)
    })
  }, [copy.statuses, copy.tiers, members, query])

  const activeCount = useMemo(() => members.filter((member) => member.status === "ACTIVE").length, [members])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setRefreshing(false)
    }
  }

  const updateMembership = async (body: { status?: MembershipStatus; tier?: MembershipTier }) => {
    if (!organizationId || !selectedMember) return
    setUpdating(true)
    setError(null)
    try {
      const response = await fetch("/api/customer-club/membership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          membershipId: selectedMember.id,
          customerId: selectedMember.customerId,
          ...body,
        }),
      })

      if (!response.ok) {
        throw new Error(await readError(response, "Failed to update customer club member"))
      }

      await fetchMembers()
      setSelectedMember(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-28 rounded-lg bg-muted" />
          <div className="h-28 rounded-lg bg-muted" />
        </div>
        <div className="h-56 rounded-lg bg-muted" />
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-normal">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/dashboard/customer-club/segments`} className={buttonVariants({ variant: "outline" })}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {copy.segments ?? "Segments"}
          </Link>
          <Link href={`/${locale}/dashboard/customer-club/loyalty`} className={buttonVariants({ variant: "outline" })}>
            <Coins className="h-4 w-4" aria-hidden="true" />
            {copy.loyalty ?? "Loyalty"}
          </Link>
          <Link href={`/${locale}/dashboard/customer-club/coupons`} className={buttonVariants({ variant: "outline" })}>
            <Gift className="h-4 w-4" aria-hidden="true" />
            {copy.coupons ?? "Coupons"}
          </Link>
          <Link href={`/${locale}/dashboard/customer-club/push`} className={buttonVariants({ variant: "outline" })}>
            <Bell className="h-4 w-4" aria-hidden="true" />
            {copy.push ?? "Web Push"}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={refreshing || updating}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.members}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCount(members.length, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.activeMembers}</CardTitle>
            <UserRoundCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCount(activeCount, locale)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="pr-10" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{copy.errorTitle}</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {filteredMembers.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{copy.customer}</th>
                  <th className="px-4 py-3 text-start font-medium">{copy.status}</th>
                  <th className="px-4 py-3 text-start font-medium">{copy.tier}</th>
                  <th className="px-4 py-3 text-start font-medium">{copy.source}</th>
                  <th className="px-4 py-3 text-start font-medium">{copy.joinedAt}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="cursor-pointer border-t transition hover:bg-muted/40"
                    onClick={() => setSelectedMember(member)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{getDisplayName(member)}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.customer.email || member.customer.phone || copy.noContact}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={member.status === "ACTIVE" ? "default" : member.status === "BLOCKED" ? "destructive" : "secondary"}>
                        {copy.statuses[member.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={member.tier === "VIP" ? "default" : "outline"} className="gap-1">
                        {member.tier === "VIP" && <Crown className="h-3 w-3" aria-hidden="true" />}
                        {copy.tiers[member.tier]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{member.source.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(member.joinedAt).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">{copy.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {copy.showing} {formatCount(filteredMembers.length, locale)} / {formatCount(members.length, locale)}
      </p>

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.manageMember}</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-1 p-4">
                  <p className="font-medium">{getDisplayName(selectedMember)}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMember.customer.email || selectedMember.customer.phone || copy.noContact}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{copy.status}</label>
                  <Select value={selectedMember.status} onValueChange={(value) => updateMembership({ status: value as MembershipStatus })} disabled={updating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(copy.statuses).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{copy.tier}</label>
                  <Select value={selectedMember.tier} onValueChange={(value) => updateMembership({ tier: value as MembershipTier })} disabled={updating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(copy.tiers).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{copy.updateHint}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
