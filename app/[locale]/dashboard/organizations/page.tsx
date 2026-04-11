"use client"
// TODO: complete the members page
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useAuth, useDashboardAccess } from "@/hooks/use-auth"
import { OrganizationMember, User } from "@prisma/client"

interface Member {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  joinDate: Date
  status: "active" | "inactive"
}

interface Organization {
  id: string
  name: string
  slug: string
  type: "SHOP" | "APPOINTMENT"
  description: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo: string | null
  coverImage: string | null
}

// Persian number helper
function toPersianDigits(str: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str)
    .split("")
    .map((char) => (/\d/.test(char) ? persianDigits[parseInt(char)] : char))
    .join("");
}

function formatToman(amount: number): string {
  return toPersianDigits(amount.toLocaleString("fa-IR")) + " تومان";
}



export default function OganizationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
    const { user } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  //const [members, setMembers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // fetch orgs
  useEffect(() => {
    
    setLoading(true)
    
    fetch("/api/organizations")
      .then(res => res.json())
      .then((orgs) => {    
        //console.log("-----------------------------orgs",orgs.data);
          
      setOrganizations(orgs.data)
    }).catch(() => {
      setOrganizations([])
    }).finally(() => setLoading(false))
  }, [])
 
   const t = (key: string): string => {
     if (!dict) return key
     return getDictValue(dict, key)
   }

  const filteredOrganizations = searchQuery?.length<1 
  ? organizations
  : organizations?.length>0 
    ? organizations.filter(org => 
      org.name?.includes(searchQuery) ||
      org.slug?.includes(searchQuery) ||
      org.description?.includes(searchQuery)
    )
    : []

  // Show loading state while checking access
  if (!mounted) {
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
  if (user?.role !== "SUPER_ADMIN") {
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
          <h2 className="text-2xl font-bold">{t("navigation.organizations") || "اعضا"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(organizations.length?.toString())} {t("navigation.organizations") || "اعضا"}
          </p>
        </div>
        <Link 
          href={`/${locale}/dashboard/organizations/new`}
          className="text-muted-foreground hover:text-foreground"
        >
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          {t("organization.create") || "افزودن"}
        </Button>
        </Link>
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

      {/* Organizations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOrganizations.length > 0 && filteredOrganizations.map((org) => (
          <Card key={locale+org.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={org.email || undefined} />
                  <AvatarFallback>
                    {org.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {org.name}
                  </CardTitle>
                
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 p-0">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 ml-2" />
                    {t("common.view") || "مشاهده"}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 ml-2" />
                    {t("common.edit") || "ویرایش"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 ml-2" />
                    {t("common.delete") || "حذف"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="ltr">{org.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{org.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={org.type === "APPOINTMENT" ? "default" : "default"}>
                  {org.type === "APPOINTMENT" ? (t("organization.appointmentType") || "نوبت دهی") : (t("organization.shopType") || "فروشگاه")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredOrganizations.length?.toString()||"1")} {t("common.of") || "از"} {toPersianDigits(filteredOrganizations.length?.toString()||"1")}
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
    </div>
  )
}


