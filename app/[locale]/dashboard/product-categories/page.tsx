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
  Tag,
  FolderOpen,
  GripVertical,
  Box,
  Package,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"

interface Category {
  id: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  _count?: {
    products: number
  }
}

export default function ProductCategoriesPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  
  // Search
  const [searchQuery, setSearchQuery] = useState("")
  
  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  })
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch categories
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    fetch("/api/product-categories?pageSize=100")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch categories")
        return res.json()
      })
      .then(data => {
        setCategories(data.data || [])
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setCategories([])
      })
      .finally(() => setLoading(false))
  }, [hasAccess, accessLoading])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Filter categories
  const filteredCategories = categories.filter(category => {
    const name = category.name || ""
    const description = category.description || ""
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Open create dialog
  const openCreateDialog = () => {
    setEditingCategory(null)
    setFormData({
      name: "",
      description: "",
      isActive: true,
    })
    setDialogOpen(true)
  }

  // Open edit dialog
  const openEditDialog = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || "",
      isActive: category.isActive,
    })
    setDialogOpen(true)
  }

  // Handle form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError(t("errors.required_fields") || "Name is required")
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const url = editingCategory 
        ? `/api/product-categories/${editingCategory.id}`
        : "/api/product-categories"
      const method = editingCategory ? "PATCH" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save category")
      }
      
      const savedCategory = await response.json()
      
      if (editingCategory) {
        setCategories(prev => 
          prev.map(c => c.id === editingCategory.id ? savedCategory : c)
        )
      } else {
        setCategories(prev => [...prev, savedCategory])
      }
      
      setDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save category")
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!categoryToDelete) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/product-categories/${categoryToDelete.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete category")
      }
      
      setCategories(prev => prev.filter(c => c.id !== categoryToDelete.id))
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category")
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
            <div key={locale+i} className="h-24 bg-muted rounded animate-pulse" />
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
          <h2 className="text-2xl font-bold">{t("product.categories") || "Service Categories"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(filteredCategories.length)} {t("product.category") || "category"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/dashboard/products`}>
            <Button variant="outline">
              <Package className="h-4 w-4 ml-2" />
              {t("navigation.products") || "Services"}
            </Button>
          </Link>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 ml-2" />
            {t("common.add") || "Add Category"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search") || "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Categories List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={locale+i} className="h-20" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("common.no_results") || "No categories found"}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery 
                ? "Try adjusting your search"
                : "Get started by creating your first category"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 ml-2" />
                {t("common.add") || "Add Category"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category, index) => (
            <Card key={locale+category.id || `category-${index}`} className={!category.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{category.name}</h3>
                      <Badge variant={category.isActive ? "default" : "secondary"}>
                        {category.isActive 
                          ? (t("common.active") || "Active") 
                          : (t("common.inactive") || "Inactive")}
                      </Badge>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {toPersianDigits(category._count?.products || 0)} {t("navigation.products") || "products"}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger className="cursor-pointer hover:bg-accent rounded-md p-2">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(category)}>
                          <Edit className="h-4 w-4 ml-2" />
                          {t("common.edit") || "Edit"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setCategoryToDelete(category)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          {t("common.delete") || "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory 
                ? (t("product.editCategory") || "Edit Category")
                : (t("product.newCategory") || "New Category")}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? (t("product.editCategoryDescription") || "Update the category details below")
                : (t("product.newCategoryDescription") || "Create a new category to organize your products")}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("product.name") || "Name"} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t("product.categoryNamePlaceholder") || "Category name"}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">{t("product.categoryDescription") || "Description"}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("product.categoryDescriptionPlaceholder") || "Category description"}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") || "Saving..." : t("common.save") || "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete") || "Delete Category"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? This action cannot be undone.
              {categoryToDelete?._count?.products ? (
                <span className="block mt-2 text-destructive">
                  This category has {categoryToDelete._count.products} products. Please move or delete them first.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting || (categoryToDelete?._count?.products || 0) > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("common.loading") || "Deleting..." : t("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}