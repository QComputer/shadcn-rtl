"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { conversionContent } from "@/lib/content/b2b-conversion-content"

type Locale = "fa" | "en" | "ar"

export function RequestDemoForm({ locale, content }: { locale: Locale; content: typeof conversionContent.fa.requestDemo }) {
  const [formData, setFormData] = useState({
    fullName: "",
    businessName: "",
    businessType: "",
    phone: "",
    city: "",
    description: "",
    preferredContactTime: "",
    consent: false,
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target
    setFormData((prev) => ({
      ...prev,
      [target.name]: target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.consent) {
      alert("لطفاً تأییدیه را بزنید.")
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-bold">{content.successTitle}</h3>
        <p className="text-muted-foreground">{content.successMessage}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href={`/${locale}/pricing`}>
            <Button size="lg" className="rounded-xl">مشاهده تعرفه‌ها</Button>
          </Link>
          <Link href={`/${locale}/demo`}>
            <Button size="lg" variant="outline" className="rounded-xl bg-background/60">مشاهده نمونه‌ها</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">{content.fields.fullName}</Label>
          <Input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessName">{content.fields.businessName}</Label>
          <Input id="businessName" name="businessName" required value={formData.businessName} onChange={handleChange} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessType">{content.fields.businessType}</Label>
          <select
            id="businessType"
            name="businessType"
            required
            value={formData.businessType}
            onChange={handleChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value="">انتخاب کنید</option>
            <option value="shop">فروشگاه</option>
            <option value="restaurant">رستوران/کافه</option>
            <option value="pharmacy">داروخانه</option>
            <option value="clinic">مطب/کلینیک</option>
            <option value="beauty">سالن زیبایی</option>
            <option value="education">مرکز آموزشی</option>
            <option value="repair">خدمات فنی/تعمیراتی</option>
            <option value="service">سازمان خدماتی</option>
            <option value="other">سایر</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{content.fields.phone}</Label>
          <Input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">{content.fields.city}</Label>
          <Input id="city" name="city" value={formData.city} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredContactTime">{content.fields.preferredContactTime}</Label>
          <Input id="preferredContactTime" name="preferredContactTime" value={formData.preferredContactTime} onChange={handleChange} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{content.fields.description}</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={formData.description}
          onChange={handleChange}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          checked={formData.consent}
          onChange={handleChange}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <Label htmlFor="consent" className="text-sm leading-relaxed">
          {content.fields.consent}
        </Label>
      </div>

      <Button type="submit" className="w-full" size="lg">
        {content.submit}
      </Button>
    </form>
  )
}
