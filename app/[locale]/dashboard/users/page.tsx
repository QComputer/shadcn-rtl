"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
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
  ChessKing,
  ChessKnight,
  ChessPawnIcon,
  ChessQueen
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"
import { useAuth } from "@/hooks/use-auth"
import { formatPersianDate, toPersianDigits } from "@/lib/persian"
import { toJalali } from "@/lib/jalali-adapter"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ClientOrganization as Organization, ClientUser as User } from "@/lib/client-model-types"

// Sample data
const roleConfig: Record<string, { label: string; icon: typeof ChessKing; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ADMIN: { label: "ادمین", icon: ChessKing, color: "bg-purple-600", variant: "secondary" },
  MANAGER: { label: "مدیر", icon: ChessQueen, color: "bg-blue-500", variant: "default" },
  STAFF: { label: "کارمند", icon: ChessPawnIcon, color: "bg-gray-600", variant: "default" },
  CUSTOMER: { label: "مشتری", icon: ChessPawnIcon, color: "bg-green-700", variant: "default" },
  DRIVER: { label: "پیک", icon: ChessKnight, color: "bg-gray-600", variant: "default" },
}



export default function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const {user} = useAuth()
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const [locale, setLocale] = useState(user?.locale || 'fa' )
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<any[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedUser, setSelectedUser] = useState<any|null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState("")
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [isActiveFilter, setIsActiveFilter] = useState("all")

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])
  // Fetch orders from API
    useEffect(() => {
      if (mounted && user) {
        fetchUsers()
        fetchOrganizations()
      }
    }, [mounted, user])
  
    const fetchUsers = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
        })
        
        const response = await fetch(`/api/users`)
        if (!response.ok) {
          throw new Error("Failed to fetch users")
        }
        
        const data = await response.json()
  
        setUsers(data.data)
        //console.log("------------------------>Users",data.data);
        
      } catch (err) {
        console.error("Error fetching orders:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    const fetchOrganizations = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/organizations`)
        if (!response.ok) {
          throw new Error("Failed to fetch users")
        }
        
        const data = await response.json()
  
        setOrganizations(data.data)
        //console.log("------------------------>organizations",data.data);
        
      } catch (err) {
        console.error("Error fetching organizations:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

 const handleDeleteUser = async ()=>{
  try {
      setUpdating(true)
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete user ")
      }
      
      setLoading(true)
      fetchUsers()

      // Update selected user if dialog is open
      if (selectedUser?.id === selectedUser.id) {
        setSelectedUser(null)
      }

    } catch (err) {
      console.error("Error deleting user:", err)
      setError(err instanceof Error ? err.message : "Failed to delete user")
    } finally {
      setUpdating(false)
    }
 }

  const handleUpdateIsActive = async (userId: string, isActive: boolean) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive}),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update user activation")
      }
      
      setLoading(true)
      fetchUsers()

      // Update selected member if dialog is open
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
      }

    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateMemberIsActive = async (userId: string, isActive: boolean) => {
    try {
      setUpdating(true)
      const userResponse = await fetch(`/api/users/${selectedUser.id}`)
      
      if (!userResponse.ok) {
        throw new Error("Failed to find user")
      }
      const user = (await userResponse.json())
      if (!user.memberOf?.organizationId || !user.memberOf?.id) {
        throw new Error("User has no organization membership to update")
      }

      const response = await fetch(`/api/organizations/${user.memberOf.organizationId}/members/${user.memberOf.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive }),
      })

      const res =  await response.json()
      
      if (!response.ok) {
        throw new Error("Failed to update user activation")
      }
      setLoading(true)
      fetchUsers()

      // Update selected member if dialog is open
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
      }

    } catch (err) {
      console.error("Error updating user activation:", err)
      setError(err instanceof Error ? err.message : "Failed to update user activation")
    } finally {
      setUpdating(false)
    }
  }

  function seIsActive(isActive?: boolean): string {
    return isActive? "active" : "inactive"
  }

  const handleUpdateOrganization = async (userId: string, organizationId: string, role: string= 'STAFF')  => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update user organization membership")
      }
      const data = await response.json()
      //console.log("-------------------------->response:",data);
      
      setLoading(true)
      fetchUsers()

      // Update selected member if dialog is open
      if (selectedUser?.id === userId) {
        setSelectedUser(null)
      }

    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      setSelectedUser(null)
      setLoading(true)
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) {
        throw new Error("Failed to update user role")
      }
      fetchUsers()
    } catch (err) {
      console.error("Error updating user role:", err)
      setError(err instanceof Error ? err.message : "Failed to update user role")
    } finally {
      setUpdating(false)
    }
  }

  // Show loading state while checking access
  if (accessLoading || !mounted) {
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
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">دسترسی محدود</h2>
          <p className="text-muted-foreground mt-2">شما دسترسی به این صفحه را ندارید</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.users") || "مشتریان"}</h2>
          <p className="text-muted-foreground">
            {users.length && toPersianDigits(users.length.toString())} {t("navigation.users") || "مشتریان"}
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

      {/* Users Grid */}
      {(users) && <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <Card 
            key={locale+user.id} 
            className="hover:shadow-md transition-shadow"
            onClick={()=>setSelectedUser(user)}
            >
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.email || "email"} />
                  <AvatarFallback>
                    {user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {user.name} {user.firstName} {user.lastName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("common.since") || "عضو از"} {formatPersianDate(user.createdAt)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{user.phone}</span>
                </div>

              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant='outline' className={roleConfig[user.role]?.color || "bg-gray-500"}>
                  {(user.role == "ADMIN")? <ChessKing/> : (user.role == "MANAGER") ? <ChessQueen/> : <ChessPawnIcon/>}
                  {user.role}
                </Badge>
                <Badge variant={user.isActive ? "default" : "destructive"}>
                  {user.isActive ? (t("common.active") || "فعال") : (t("common.inactive") || "غیرفعال")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      

      {/* Pagination */}
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>


      </div>
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>جزئیات کاربر</DialogTitle>
          </DialogHeader>
          {selectedUser && (
          <Card key={locale+selectedUser.id} 
            className="hover:shadow-md transition-shadow"
            onClick={()=>setSelectedUser(null)}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={selectedUser.email || undefined} />
            <AvatarFallback>
              {selectedUser.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-lg">
              {selectedUser.name} {selectedUser.firstName} {selectedUser.lastName}
            </CardTitle>
          </div>
        </div>
            </CardHeader>
            <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="ltr">{selectedUser.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{selectedUser.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Badge variant={selectedUser.isActive ? "default" : "destructive"}>
            {selectedUser.isActive ? (t("common.active") || "فعال") : (t("common.inactive") || "غیرفعال")}
          </Badge>
        </div>
            </CardContent>
            <CardFooter className="gap-5 ">
              <Button variant="destructive" onClick={handleDeleteUser}>

              </Button>
              <div 
          className="grid grid-cols-2"
              >
        <Select 
              value={selectedUser.role} 
              onValueChange={(value) => handleUpdateRole(selectedUser.id, value)}
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
          value={selectedUser?.memberOf?.organizationId || "عضو نیست"} 
          onValueChange={(value) => handleUpdateOrganization(selectedUser.id, value, selectedUser.role)}
          disabled={updating}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={locale+org.slug} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

<Button 
       variant={!selectedUser.isActive ? "default" : "destructive"}
        onClick={()=>handleUpdateIsActive(selectedUser?.id, !selectedUser.isActive)}>
          {!selectedUser.isActive ? "فعال کردن" : "غیرفعال کردن"}
        </Button>
        <Button 
       variant={!selectedUser.memberOf?.isActive ? "default" : "destructive"}
        onClick={()=>handleUpdateMemberIsActive(selectedUser?.id, !selectedUser.memberOf?.isActive)}>
          {!selectedUser.memberOf?.isActive ? "فعال کردن" : "غیرفعال کردن"}
        </Button>
        
            </div>
            </CardFooter>
          </Card>)}
        </DialogContent>
      </Dialog>
      </>}
    </div>
  )
}
