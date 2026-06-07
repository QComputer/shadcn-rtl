"use client"
// TODO: complete the members page
import { useState, useEffect, use } from "react"
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  MoreVertical,
  Clock,
  Package,
  ChessKing,
  ChessQueen,
  ChessPawnIcon,
  ChessKnight,
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"
import { toPersianDigits } from "@/lib/persian"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Me {
  user: User
  memberOf: {
    id: string,
    organization: Organization
  }
}

interface User {
  id: string
  name: string
  role: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  joinDate: Date
  status: "active" | "inactive"
}

interface Member {
  isActive: boolean,
  joinedAt: Date,
  user: User
}


interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo: string | null
  coverImage: string | null
}

const roleConfig: Record<string, { label: string; icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ADMIN: { label: "ادمین", icon: ChessKing, color: "bg-yellow-500", variant: "secondary" },
  MANAGER: { label: "مدیر", icon: ChessQueen, color: "bg-blue-200", variant: "default" },
  STAFF: { label: "کارمند", icon: ChessPawnIcon, color: "bg-green-200", variant: "default" },
  DRIVER: { label: "پیک", icon: ChessKnight, color: "bg-purple-500", variant: "default" },
}


export default function OganizationMembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [members, setMembers] = useState<Member[]>([])
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember,setSelectedMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // fetch org-members
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/users/me/membership")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch membership");
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const orgId = data?.membership?.organizationId;
        if (!orgId) throw new Error("No active organization membership");
        return fetch(`/api/organizations/${orgId}/members`);
      })
      .then(res => {
        if (!res) return;
        if (!res.ok) throw new Error("Failed to fetch members");
        return res.json();
      })
      .then(members => {
        if (cancelled) return;
        setMembers(members || []);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true };
  }, [])
 
   const t = (key: string): string => {
     if (!dict) return key
     return getDictValue(dict, key)
   }

  const filteredMembers = members
  /*.filter(member => 
    member.user?.firstName?.includes(searchQuery) ||
    member.user?.lastName?.includes(searchQuery) ||
    member.user?.name?.includes(searchQuery)
  )*/

    
  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update order status")
      }
      
      setLoading(true)
      fetch(`/api/organizations/noId/members`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch members")
        return res.json()
      })
      .then(members => {
        setMembers(members)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
      
      // Update selected member if dialog is open
      if (selectedMember?.user?.id === userId) {
        setSelectedMember(null)
      }
    } catch (err) {
      console.error("Error updating user avtivation status:", err)
      setError(err instanceof Error ? err.message : "Failed to update user avtivation status")
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateIsActive = async (userId: string, isActive: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: isActive == "active" ? true : false }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update user activation status")
      }
      
      setLoading(true)
      fetch(`/api/organizations/noId/members`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch appointments")
        return res.json()
      })
      .then(members => {
        setMembers(members)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
      
      // Update selected member if dialog is open
      if (selectedMember?.user?.id === userId) {
        setSelectedMember(null)
      }
    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }
  }

  // Show loading state while checking access
  if (!mounted || loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={locale+i} className="h-24 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Show access denied message if no access
  if (false) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">دسترسی محدود</h2>
          <p className="text-muted-foreground mt-2">شما دسترسی به این صفحه را ندارید</p>
        </div>
      </div>
    )
  }

  function geIsActive(isActive: boolean): string | undefined {
    return isActive? "active" : "inactive"
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.members") || "اعضا"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(members.length.toString())} {t("navigation.members") || "اعضا"}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          {t("common.add") || "افزودن"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search") || "جستجو..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Members Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => (
          <Card key={locale+member.user.id} 
          className="hover:shadow-md transition-shadow"
          onClick={()=>setSelectedMember(member)}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.user.name || undefined} />
                  <AvatarFallback>
                    {member.user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {member.user.name} {member.user.firstName} {member.user.lastName}
                  </CardTitle>
                
                </div>
              </div>

            </CardHeader>
            <CardContent>
              
              <div className="mt-4 flex items-center justify-between">
                <Badge variant='outline'>
                  {member.user.role}
                </Badge>
                <Badge variant={member.isActive ? "default" : "destructive"}>
                  {member.isActive ? (t("common.active") || "فعال") : (t("common.inactive") || "غیرفعال")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredMembers.length.toString())} {t("common.of") || "از"} {toPersianDigits(members.length.toString())}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>جزئیات کارمند</DialogTitle>
                </DialogHeader>
                {selectedMember && (
                <Card key={locale+selectedMember.user.id} 
                className="hover:shadow-md transition-shadow"
                onClick={()=>setSelectedMember(selectedMember)}>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedMember.user.email || undefined} />
                  <AvatarFallback>
                    {selectedMember.user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {selectedMember.user.name} {selectedMember.user.firstName} {selectedMember.user.lastName}
                  </CardTitle>
                
                </div>
              </div>

                  </CardHeader>
                  <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="ltr">{selectedMember.user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{selectedMember.user.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={selectedMember.isActive ? "default" : "destructive"}>
                  {selectedMember.isActive ? (t("common.active") || "فعال") : (t("common.inactive") || "غیرفعال")}
                </Badge>
              </div>
                  </CardContent>
                  <CardFooter className="gap-5">
              <Select 
                value={selectedMember.user.role} 
                onValueChange={(value) => handleUpdateRole(selectedMember.user.id, value)}
                disabled={updating}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={locale+key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={geIsActive(selectedMember.isActive)} 
                onValueChange={(value) => handleUpdateIsActive(selectedMember.user.id, value)}
                disabled={updating}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem key={locale+'active'} value={'active'}>
                      {'فعال'}
                    </SelectItem>
                    <SelectItem key={locale+'inactive'} value={'inactive'}>
                      {'غیر فعال'}
                    </SelectItem>
                </SelectContent>
              </Select>
                  </CardFooter>
                </Card>)}
            </DialogContent>
            </Dialog>
    </div>


  )
}
