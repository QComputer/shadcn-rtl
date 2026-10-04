"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Star, Trash2, Upload, X } from "lucide-react"
import { appFetch } from "@/lib/app-base-path"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type GalleryItem = {
  id: string
  sortOrder: number
  isPrimary: boolean
  image: { id: string | number; url: string; thumbnailUrl?: string | null; filename?: string | null }
}

type UploadResult = { id: string | number; url: string; thumbnailUrl?: string | null }

type Props = {
  productId: string
  variants: Array<{ id?: string; name: string }>
  uploadFile: (file: File, onProgress?: (value: number) => void) => Promise<UploadResult>
}

export function ProductGalleryEditor({ productId, variants, uploadFile }: Props) {
  const [variantId, setVariantId] = useState<string>("")
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const endpoint = variantId
    ? `/api/products/${productId}/variants/${variantId}/gallery`
    : `/api/products/${productId}/gallery`

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const response = await appFetch(endpoint)
      if (!response.ok) throw new Error("بارگذاری گالری انجام نشد")
      setItems(await response.json())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "بارگذاری گالری انجام نشد")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [endpoint])

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFile(file, setProgress)
        const response = await appFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId: uploaded.id, isPrimary: items.length === 0 && file === files[0] }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error || "ثبت تصویر در گالری انجام نشد")
        }
      }
      setMessage("تصاویر گالری ذخیره شدند")
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "آپلود تصویر انجام نشد")
    } finally {
      setProgress(0)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function updateItem(item: GalleryItem, patch: { isPrimary?: boolean; sortOrder?: number }) {
    setError(null)
    const response = await appFetch(`${endpoint}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error || "به‌روزرسانی تصویر انجام نشد")
      return
    }
    await refresh()
  }

  async function removeItem(item: GalleryItem, confirm = true) {
    if (confirm && !window.confirm("این تصویر از گالری جدا شود؟ فایل اصلی حذف نمی‌شود.")) return false
    setError(null)
    const response = await appFetch(`${endpoint}/${item.id}`, { method: "DELETE" })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error || "حذف تصویر انجام نشد")
      return false
    }
    await refresh()
    return true
  }

  async function replaceItem(item: GalleryItem, file: File) {
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadFile(file, setProgress)
      const response = await appFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: uploaded.id, isPrimary: item.isPrimary, sortOrder: item.sortOrder }),
      })
      if (!response.ok) throw new Error("تصویر جدید ثبت نشد")
      await removeItem(item, false)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "جایگزینی تصویر انجام نشد")
    } finally {
      setProgress(0)
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>گالری تصاویر {variantId ? "نسخه انتخاب‌شده" : "محصول"}</CardTitle>
        <div className="flex items-center gap-2">
          <select aria-label="انتخاب نسخه برای گالری" value={variantId} onChange={(event) => setVariantId(event.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">گالری محصول</option>
            {variants.filter((variant) => variant.id).map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
          </select>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} افزودن تصاویر
          </Button>
          <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => void addFiles(event.target.files)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {uploading && <div role="status" className="text-sm text-muted-foreground">در حال آپلود: {progress}%</div>}
        {message && <div role="status" className="text-sm text-green-700">{message}</div>}
        {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری...</div> : items.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"><ImagePlus className="mx-auto mb-2 h-6 w-6" />هنوز تصویری اضافه نشده است</div> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => <div key={item.id} className="space-y-2 rounded-md border p-2">
              <div className="relative aspect-square overflow-hidden rounded bg-muted"><img src={item.image.thumbnailUrl || item.image.url} alt={item.image.filename || "تصویر محصول"} loading="lazy" className="h-full w-full object-cover" />{item.isPrimary && <Badge className="absolute left-1 top-1 gap-1"><Star className="h-3 w-3 fill-current" /> اصلی</Badge>}</div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="تصویر اصلی" onClick={() => void updateItem(item, { isPrimary: true })}><Star className={item.isPrimary ? "h-4 w-4 fill-current" : "h-4 w-4"} /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="جابجایی به بالا" disabled={index === 0} onClick={() => void updateItem(item, { sortOrder: Math.max(0, item.sortOrder - 1) })}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="جابجایی به پایین" disabled={index === items.length - 1} onClick={() => void updateItem(item, { sortOrder: item.sortOrder + 1 })}><ArrowDown className="h-4 w-4" /></Button>
                <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent" aria-label="جایگزینی تصویر"><X className="h-4 w-4" /><input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceItem(item, file) }} /></label>
                <Button type="button" size="icon" variant="ghost" aria-label="حذف تصویر" onClick={() => void removeItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
