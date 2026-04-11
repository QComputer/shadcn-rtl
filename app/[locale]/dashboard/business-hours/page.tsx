"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  ChevronRight,
  Star,
  Users,
  CheckCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"

interface BusinessHour {
  day: string
  openTime: string
  closeTime: string
  isOpen: boolean
}

// Persian day names mapping
const dayNames: Record<string, string> = {
  SATURDAY: "شنبه",
  SUNDAY: "یکشنبه",
  MONDAY: "دوشنبه",
  TUESDAY: "سه‌شنبه",
  WEDNESDAY: "چهارشنبه",
  THURSDAY: "پنج‌شنبه",
  FRIDAY: "جمعه",
}

export default function BusinessHoursPage({ 
  params 
}: { 
  params: Promise<{ locale: string; id: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const id = resolvedParams.id
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<BusinessHour[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Load dictionary
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch user data
    fetch(`/api/users/me/business-hours`)
      .then(res => {
        if (!res.ok) throw new Error("User not found")
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [locale, id])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Get today's hours
  const getTodayHours = () => {
    if (!data) return null
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const dayMap: Record<string, string> = {
      Saturday: "SATURDAY",
      Sunday: "SUNDAY",
      Monday: "MONDAY",
      Tuesday: "TUESDAY",
      Wednesday: "WEDNESDAY",
      Thursday: "THURSDAY",
      Friday: "FRIDAY",
    }
    const englishDay = dayMap[today]
    return data.find(h => h.day === englishDay)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-96 w-full" />
        <div className="container mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t("errors.notFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || "Organization not found"}</p>
            <Button className="mt-4">
              <Link href="/">{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const todayHours = getTodayHours()

  return (
    <div className="min-h-screen bg-background">
      {/* Business Hours */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">{t("organization.businessHours")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data?.map((hours) => (
              <Card key={locale+hours.day}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dayNames[hours.day]}</span>
                    <Badge variant={hours.isOpen ? "default" : "secondary"}>
                      {hours.isOpen ? t("organization.open") : t("organization.closed")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    {hours.isOpen 
                      ? `${hours.openTime} - ${hours.closeTime}`
                      : "-"
                    }
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
