"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  DollarSign,
  Tag,
  User,
  Eye,
  Scissors,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  image: string | null
  isActive: boolean
  category: {
    id: string
    name: string
  }
  serviceProvider: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
  } | null
  _count?: {
    appointments: number
  }
}

interface Category {
  id: string
  name: string
  _count?: {
    services: number
  }
}

export default function ServicesDashboardPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Get session for role-based fetching
  const { data: session } = useSession()

  // Fetch services and categories
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    // Fetch services - use provider=me for staff users
    const servicesUrl = session?.user?.role === "STAFF" 
      ? "/api/services?provider=me" 
      : "/api/services"
    
    fetch(servicesUrl)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch services")
        return res.json()
      })
      .then(data => {
        setServices(data.data || [])
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setServices([])
      })
    
    // Fetch categories
    fetch("/api/service-categories")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch categories")
        return res.json()
      })
      .then(data => {
        setCategories(data.data || [])
      })
      .catch(() => {
        setCategories([])
      })
      .finally(() => setLoading(false))
  }, [hasAccess, accessLoading, session])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Filter services
  const filteredServices = services.filter(service => {
    const name = service.name || ""
    const description = service.description || ""
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || service.category.id === selectedCategory
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && service.isActive) ||
      (statusFilter === "inactive" && !service.isActive)
    return matchesSearch && matchesCategory && matchesStatus
  })

  // Toggle service active status
  const toggleActive = async (service: Service) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !service.isActive }),
      })
      
      if (!response.ok) throw new Error("Failed to update service")
      
      // Update local state
      setServices(prev => 
        prev.map(s => 
          s.id === service.id 
            ? { ...s, isActive: !s.isActive }
            : s
        )
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update service")
    }
  }

  // Delete service
  const handleDelete = async () => {
    if (!serviceToDelete) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/services/${serviceToDelete.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete service")
      }
      
      // Remove from local state
      setServices(prev => prev.filter(s => s.id !== serviceToDelete.id))
      setDeleteDialogOpen(false)
      setServiceToDelete(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete service")
    } finally {
      setDeleting(false)
    }
  }

  // Show loading state while checking access
  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={locale+i} className="h-32 bg-muted rounded animate-pulse" />
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
          <h2 className="text-2xl font-bold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have access to this page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.services") || "Services"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(filteredServices.length)} {t("service.title") || "service"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/dashboard/service-categories`}>
            <Button variant="outline">
              <Tag className="h-4 w-4 ml-2" />
              {t("service.categories") || "Categories"}
            </Button>
          </Link>
          <Link href={`/${locale}/dashboard/services/new`}>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              {t("common.add") || "Add Service"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") || "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("service.category") || "Category"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all") || "All"}</SelectItem>
            {categories.map(category => (
              <SelectItem key={locale+category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder={t("common.status") || "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all") || "All"}</SelectItem>
            <SelectItem value="active">{t("common.active") || "Active"}</SelectItem>
            <SelectItem value="inactive">{t("common.inactive") || "Inactive"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={locale+i} className="h-48" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : filteredServices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scissors className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("common.no_results") || "No services found"}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery || selectedCategory !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first service"}
            </p>
            {!searchQuery && selectedCategory === "all" && statusFilter === "all" && (
              <Link href={`/${locale}/dashboard/services/new`}>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 ml-2" />
                  {t("common.add") || "Add Service"}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service, index) => (
            <Card key={locale+service.id || `service-${index}`} className={!service.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">{service.name}</CardTitle>
                    <Badge 
                      variant={service.isActive ? "default" : "secondary"} 
                      className="mt-1"
                    >
                      {service.isActive 
                        ? (t("common.active") || "Active") 
                        : (t("common.inactive") || "Inactive")}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="cursor-pointer hover:bg-accent rounded-md p-2">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/${locale}/dashboard/services/${service.id}`} className="flex items-center w-full">
                          <Edit className="h-4 w-4 ml-2" />
                          {t("common.edit") || "Edit"}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(service)}>
                        {service.isActive ? (
                          <>
                            <ToggleLeft className="h-4 w-4 ml-2" />
                            {t("common.deactivate") || "Deactivate"}
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-4 w-4 ml-2" />
                            {t("common.activate") || "Activate"}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => {
                          setServiceToDelete(service)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        {t("common.delete") || "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {service.description || t("common.no_description") || "No description"}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {t("service.category") || "Category"}:
                    </span>
                    <span>{service.category?.name || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("appointment.duration") || "Duration"}:
                    </span>
                    <span>{toPersianDigits(service.duration)} {t("appointment.minutes") || "min"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {t("order.total") || "Price"}:
                    </span>
                    <span className="font-medium text-primary">
                      {formatToman(service.price)}
                    </span>
                  </div>
                  {service.serviceProvider && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {t("appointment.provider") || "Provider"}:
                      </span>
                      <span>
                        {service.serviceProvider.firstName} {service.serviceProvider.lastName}
                      </span>
                    </div>
                  )}
                  {service._count && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {t("appointment.title") || "Appointments"}:
                      </span>
                      <span>{toPersianDigits(service._count.appointments || 0)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.delete") || "Delete Service"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{serviceToDelete?.name}"? This action cannot be undone.
              {serviceToDelete?._count?.appointments ? (
                <span className="block mt-2 text-destructive">
                  This service has {serviceToDelete._count.appointments} appointments.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t("common.loading") || "Deleting..." : t("common.delete") || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}