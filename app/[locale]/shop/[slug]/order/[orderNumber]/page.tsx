"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  ChevronRight, 
  CheckCircle, 
  Package, 
  MapPin, 
  Phone, 
  Mail,
  ArrowRight,
  Loader2,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Timer,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { GuestCustomer, Organization, PaymentSettings, User } from "@prisma/client";
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatPersianDate, formatRelativePersianTime, formatToman, toPersianDigits } from "@/lib/persian";
import { Label } from "@/components/ui/label";
import { Input } from "@base-ui/react";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  variant: {
    id: string;
    name: string;
    product: {
      id: string;
      name: string;
      image: string | null;
      images: string[]
    };
  };
}

interface Progress {
  id: string
  estimatedEndTime: Date | null
  endTime: Date | null
}

interface Order {
  id: string
  orderNumber: string
  type: "DELIVERY" | "PICK_UP"
  status: "PENDING" | "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED" | "RECEIVED" | "REFUNDED"
  subtotal: number
  deliveryFee: number
  tax: number
  discount: number
  total: number
  deliveryAddress: string | null
  notes: string | null
  createdAt: string
  customer: User | null
  guestCustomer: GuestCustomer | null
  organizationSlug: string
  organization: Organization

  preparationProgress: Progress | null
  pickupProgress: Progress | null
  deliveryProgress: Progress | null

  assignedDriver: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
  } | null
  items: OrderItem[]

  paymentStatus: boolean
  paymentMethod: string
  paymentId: string
}

interface OrderConfirmationData {
  order: Order;
}

const PaymentCard =  async (paymentSettings: PaymentSettings|null) => {
  const int: number = paymentSettings?.paymentMethodInt || 0;
  const pCondition: boolean = paymentSettings?.paymentCondition || false;
  return(<Card>
    <CardContent>
      {int}
      {pCondition}
    </CardContent>
  </Card>)
}

export default function OrderConfirmationPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string; orderNumber: string }>
}) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug;
  const orderNumber = resolvedParams.orderNumber;

  const [mounted, setMounted] = useState(false)
  const [refetching, setRefetching] = useState(true)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrderConfirmationData | null>(null);
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings|null>(null);
  const [paymentId, setPaymentId] = useState("");

  function paymentMethodDict (int: number) {
    if (int==0) return "پرداخت نقدی و انتقال"
    else if (int==1) return "فقط پرداخت از طریق انتقال"
    else if (int==2) return "فقط پرداخت نقدی"
  }

  // Helper to get translations based on locale
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const isRTL = locale === "fa" || locale === "ar"
  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  useEffect(()=>{
    if (refetching) {
      if (orderNumber) { fetchOrder() }
      setRefetching(false)
      setTimeout(() => setRefetching(true), 3000)
    }
  }, [refetching])

  useEffect(()=>{
    slug && fetchPaymentSettings()
  }, [slug])

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })

  }, [locale])


  useEffect(() => {
    if (orderNumber) {
      fetchOrder();
    }
  }, [orderNumber]);

  async function fetchOrder() {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/orders/${orderNumber}`);
      if (!response.ok) {
        throw new Error("Order not found");
      }
      const orderData = await response.json();
      setData({ order: orderData });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPaymantId(){
    setLoading(true);
    const response = await fetch(`/api/public/orders/${orderNumber}`, {
      method: "PUT",
      headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({paymentId}),
    });
    if (!response?.ok) {
      throw new Error("Payment Id not updated");
    }
    fetchPaymentSettings()
  }

  async function fetchPaymentSettings() {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/organizations/${slug}/shop`);
      if (!response?.ok) {
        throw new Error("Organization not found");
      }
      const orgData = await response.json();
      setPaymentSettings(orgData.paymentSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, {  icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: {  icon: Clock, color: "bg-orange-500", variant: "secondary" },
  PLACED: {  icon: Package, color: "bg-yellow-500", variant: "default" },
  ACCEPTED: { icon: CheckCircle, color: "bg-blue-500", variant: "default" },
  PREPARING: {  icon: Package, color: "bg-green-400", variant: "default" },
  READY: {  icon: CheckCircle, color: "bg-green-600", variant: "default" },
  PICKED_UP: {  icon: Truck, color: "bg-blue-500", variant: "default" },
  DELIVERED: {  icon: CheckCircle, color: "bg-green-600", variant: "default" },
  CANCELLED: { icon: XCircle, color: "bg-red-500", variant: "destructive" },
  RECEIVED: {  icon: CheckCircle, color: "bg-green-700", variant: "default" },
  REFUNDED: { icon: XCircle, color: "bg-orange-500", variant: "destructive" },
}

const paymentStatusConfig: Record<string, {  icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  false: {  icon: Clock, color: "bg-red-500 text-red-10", variant: "destructive" },
  true: {  icon: Package, color: "bg-green-500 text-green-900", variant: "secondary" }
}

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <CardTitle>{t("order.notFound")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>{error || "سفارش پیدا نشد"}</p>
          </CardContent>
          <div className="p-6 pt-0 flex justify-center">
            <Link href={`/${locale}/shop/${slug}/order/${orderNumber}`}>
              <Button>
                {t("order.tryAgain")}
                <ArrowLeft className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/${locale}/shop/${slug}`} className="hover:text-foreground">
              {data.order.organization.name}
            </Link>
            <ChevronLeft className="h-4 w-4" />
            <span className="text-foreground font-medium">{t("order.title")} {data.order.orderNumber}</span>
          </nav>
        </div>
      </div>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-6">
          {/* Success Header */}
          <Card className="border-green-200 bg-green-50">
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h1 className="text-2xl font-bold text-green-800 mb-2">
                  {t("order.successfullyPlaced")}
                </h1>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-sm text-green-600">{t("order.orderNumber")+":"}</span>
                  <span className="font-mono font-bold text-green-800">{data.order.orderNumber}</span>
                </div>
              </CardContent>
          </Card>

          {/* Order Status */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t("order.status")}</span>
                  <Badge className={statusConfig[data.order.status].color}>
                    {t("order."+data.order.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("order.placedAt")} {formatPersianDate(data.order.createdAt)}
                  {"  -   ساعت " + formatPersianDate(data.order.createdAt, "time")}
                </p>
              </CardContent>
          </Card>
          
          {/* Order Payment Status */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t("order.paymentStatus")}</span>
                  <Badge className={paymentStatusConfig[data.order.paymentStatus ? "true" : "false"].color}>
                    {t("order.paymentStatus_badge."+data.order.paymentStatus)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
              {(!paymentSettings?.paymentCondition) ? 
              <div className="text-sm text-muted-foreground">
                لطفا هزینه سفارش را پرداخت کنید تا سفارش شما توسط فروشگاه پذیرفته شود
              </div>
                : 
                <div className="text-sm text-muted-foreground py-2">
                  آیا مایل به پرداخت هزینه قبل از آماده شدن سفارش هستید؟
                </div>
                }
        
                {(paymentSettings?.paymentMethodInt===0 || paymentSettings?.paymentMethodInt===1) && <>
                <div className="text-sm">
                  { "هزینه ی سفارش را به کارت "}
                </div>
                <div className="text-lg  py-2">
                  {paymentSettings?.cardNumber || "0000"}
                  {" به نام " + paymentSettings?.cardOwnerName}
                </div>
                <div className="text-sm">
                  { "واریز کرده و کد رهگیری را ارسال کنید. "}
                </div>
        
                <div dir="ltr" className="pt-2">
                <Input 
                  dir="ltr"
                  placeholder={t("order.paymentId") || "کد رهگیری واریز را وارد کنید"}
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="pr-10"
                />
                <Button className="text-xs m-1" size="sm"
                  onClick={handleSendPaymantId}>
                 ارسال 
                </Button>
                </div></>}
              </CardContent>
          </Card>
          
          {/* Progress */}
          <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    زمان های تخمیی
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 space-y-2">
                  <div className="grid gap-3 grid-cols-2 ">
                    <Label htmlFor="preparationProgress">آماده سازی:</Label>
                    <div className="col-2">
                    {data.order.preparationProgress?.estimatedEndTime && formatRelativePersianTime(data.order.preparationProgress.estimatedEndTime)} 
                    </div>
                  
                    {data.order.type==="DELIVERY" && <>

                      <Label htmlFor="preparationProgress">پیکاپ:</Label>
                    <div className="col-2">
                      {data.order.pickupProgress?.estimatedEndTime && formatRelativePersianTime(data.order.pickupProgress.estimatedEndTime)}
                    </div>
                    
                      <Label htmlFor="preparationProgress">تحویل دهی:</Label>
                    <div className="col-2">
                      {data.order.deliveryProgress?.estimatedEndTime && formatRelativePersianTime(data.order.deliveryProgress.estimatedEndTime)}
                    </div>
                    </>}
                  </div>
              </CardContent>
                    
          </Card>
          
          {/* Order Items */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {t("order.items")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.order.items.map((item) => (
                  <div key={locale+item.id} className="flex gap-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.variant.product.image? (
                        <img
                          src={item.variant.product.image}
                          alt={item.variant.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.variant.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                         × {locale==="fa" ? toPersianDigits(item.quantity) : item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatToman(item.price * item.quantity)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("order.each")} {formatToman(item.price)} 
                      </p>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="flex justify-between text-lg font-medium">
                  <span>{t('cart.total')}</span>
                  <span>{formatToman(data.order.total)}</span>
                </div>
              </CardContent>
          </Card>

          {/* Customer & Shipping Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              {(data.order.guestCustomer || data.order.customer) &&
                <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("order.customerInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span>{data.order.guestCustomer?.name}</span>
                    <span>{data.order.customer?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{data.order.guestCustomer?.phone}</span>
                    <span>{data.order.customer?.phone}</span>
                  </div>

                </CardContent>
              </Card>}

              {/* Shipping Address */}
              {(data.order.type ==="DELIVERY") &&
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t("order.address")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs">{data.order.deliveryAddress || t("order.noAddress")}</p>
                </CardContent>
              </Card>}
          </div>

          {/* Order Notes */}
          {data.order.notes && (
            <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("order.notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{data.order.notes}</p>
                </CardContent>
            </Card>
          )}
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-end items-end">
              <Link href={`/${locale}/shop/${slug}`}>
                <Button size="lg">
                  {t("order.continueShopping")}
                  {isRTL ? <ArrowLeft className="mr-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
          </div>

          </div>
        </div>
      </section>
    </div>
  );
}
