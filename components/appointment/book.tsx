"use client";

import { useState, useEffect, use } from "react"
import Link from "next/link";
import { TimeInterval } from "@/app/[locale]/dashboard/calendar/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@base-ui/react";
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { Textarea } from "../ui/textarea";
import { Service } from "@/lib/contexts/booking-context";

interface AppointmentBookerProps{
    timeInterval: TimeInterval
    serviceId?: string
}
export function AppointmentBooker(timeInterval: TimeInterval, t: (key: string) => string) {
    
    const [selectedService, setSelectedService] = useState<Service | null>(null)
    
    // Customer details
      const [customerName, setCustomerName] = useState("")
      const [customerPhone, setCustomerPhone] = useState("")
      const [customerEmail, setCustomerEmail] = useState("")
      const [notes, setNotes] = useState("")
      
      // Booking result
      const [bookingSuccess, setBookingSuccess] = useState(false)
      const [bookingError, setBookingError] = useState<string | null>(null)
      const [submitting, setSubmitting] = useState(false)
    
      return (
              <Card>
                <CardHeader>
                  <CardTitle>{t("appointment.yourInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("user.firstName")} *</Label>
                      <Input
                        id="name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="نام و نام خانوادگی"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("user.phone")} *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("user.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("appointment.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="توضیحات اضافی..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
    )
}
