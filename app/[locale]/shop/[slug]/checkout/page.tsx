"use client";
// It should not communicate with /api/chechout/ route anymore
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/contexts/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ChevronRight, 
  ShoppingBag, 
  CreditCard, 
  MapPin, 
  User as UserIcon, 
  Phone, 
  Mail,
  Loader2,
  ArrowRight,
  Package,
  Van,
  ArrowBigLeft,
  ArrowLeft,
  Clock,
  CheckCircle,
  Wallet,
} from "lucide-react";
import { formatNumber, formatPrice } from "@/lib/utils";
import { useSession } from "next-auth/react"
import { OrderType, User } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { getDictionary } from "@/lib/dictionary";
import prisma from "@/lib/db";
import { formatToman } from "@/lib/persian";

interface CheckoutFormData {
  customerName?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  customerEmail?: string;
  shippingAddress?: string;
  city?: string;
  postalCode?: string;
  notes?: string;
  paymentMethod?: "CREDIT_CARD"| "DEBIT_CARD"| "CASH"| "WALLET"| "BANK_TRANSFER"
}
const paymentMethodConfig: Record<string, { label: string; icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CASH: { label: "نقد", icon: Clock, color: "bg-orange-500", variant: "secondary" },
  CREDIT_CARD: { label: "پرداخت آنلاین", icon: CreditCard, color: "bg-blue-500", variant: "default" },
  WALLET: { label: "کیف پول", icon: Wallet, color: "bg-green-500", variant: "default" },
}
export default function CheckoutPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {

  const resolvedParams = use(params);
  const locale = resolvedParams.locale;
  const isRTL = locale === "fa" || locale === "ar"
  const dict = getDictionary(locale)
  const slug = resolvedParams.slug;
  const router = useRouter();

  const { data: session } = useSession()
  const [user, setUser] = useState<User|null>(null);
  const [loading, setLoading] = useState(true)

  const { cart, summary, isLoading: cartLoading, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelivery, setIsDelivery] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CREDIT_CARD"| "DEBIT_CARD"| "CASH"| "WALLET"| "BANK_TRANSFER">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>("");

  // Helper to get translations based on locale
  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = dict
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }


  const [formData, setFormData] = useState<any>({
      customerName: "",
      customerPhone: "",  
      customerFirstName: "",
      customerLastName: "",
      customerEmail: "",
      shippingAddress: "",
      city: "",
      postalCode: "",
      notes: "",
    });


  // Fetch organization info
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch(`/api/public/organizations/${slug}/shop`);
        if (response.ok) {
          const data = await response.json();
          setOrganizationId(data.organization.id);
          setOrganizationName(data.organization.name);
        }
      } catch (err) {
        console.error("Failed to fetch organization:", err);
      }
    }
    if (slug) {
      fetchOrganization();
    }
  }, [slug]);

  // Fetch User info
  useEffect(() => {
    if (session?.user){
      // Fetch user profile
      fetch("/api/users/me")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch profile")
        return res.json()
      })
      .then(data => {
        setUser(data as User)
        setFormData(
          (prev: any) => ({ ...prev,
            customerName: data.lastName || data.name,
            customerPhone: data.phone || "",
            customerFirstName: data.firstName || "",
            customerLastName: data.lastName || "",
            shippingAddress: data.address || "",
          })
        )
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
    }
  }, [session]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cart || cart.items.length === 0) {
      setError("Your cart is empty");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!organizationId){
        try {
        const response = await fetch(`/api/public/organizations/${slug}/shop`);
        if (response.ok) {
          const data = await response.json();
          setOrganizationId(data.organization.id);
          setOrganizationName(data.organization.name);
        } else {
          console.error("Failed to fetch organizationId");
        }
        } catch (err) {
          console.error("Failed to fetch organization:", err);
        }
      }

      // get the order created
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          paymentMethod,
          deliveryAddress: formData.shippingAddress,
          type: isDelivery? "DELIVERY" : "PICK_UP",
          customerName: formData.customerName,
          customerPhone: formData.customerPhone || "0000",
          cart,
          items: cart.items.map(item => ({
            variantId: item.variant.id,
            quantity: item.quantity,
            price: item.variant.price,
          })),
        }),
      }) 

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to place order");
      }

      const order = await response.json();
      
      // Clear the cart after successful order
      await clearCart();
      
      // Redirect to order confirmation page
      router.push(`/${locale}/shop/${slug}/order/${order.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (!cartLoading && (!cart || cart.items.length === 0)) {
      // Don't redirect immediately, show empty cart message
    }
  }, [cartLoading, cart]);

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <CardTitle>سبد خرید شما خالی است!</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>برای ادامه بررسی و تایید چند محصول اضافه کنید </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link href={`/${locale}/shop/${slug}`}>
              <Button>
                محصولات ما را ببینید
                <ArrowLeft className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
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
            <Link href={`/${locale}`} className="hover:text-foreground">
              خانه
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/${locale}/shop/${slug}`} className="hover:text-foreground">
              {organizationName}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">بررسی و تایید</span>
          </nav>
        </div>
      </div>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold mb-8">بررسی و تایید</h1>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Checkout Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* order type */}
            <div className="flex items-center justify-between">
              <div className="space-y-1 px-2">
                <Label htmlFor="delivery">
                  <Van/>{"ارسال شود؟"}
                </Label>
                <p className="text-sm text-muted-foreground flex ">
                  {" برای ارسال سفارش سویچ روبرو را فعال کنید" }<ArrowLeft className=" w-5 h-5"/>
                </p>
              </div>
              <Switch
                id="delivery"
                checked={isDelivery}
                onCheckedChange={setIsDelivery}
              />
            </div>
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5" />
                      اطلاعات مشتری
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            

                      <div className="space-y-2">
                        <Label htmlFor="customerName"> نام *</Label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="customerName"
                            name="customerName"
                            placeholder="نام ثبت کننده سفارش"
                            value={formData.customerName}
                            onChange={handleInputChange}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      {isDelivery && <div className="space-y-2">
                        <Label htmlFor="customerPhone">شماره تماس (اختیاری)</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="customerPhone"
                            name="customerPhone"
                            placeholder="+1 234 567 8900"
                            value={formData.customerPhone}
                            onChange={handleInputChange}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>}
                    </div>
                    {isDelivery && <div className="space-y-2">
                      <Label htmlFor="customerEmail">ایمیل (اختیاری)</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="customerEmail"
                          name="customerEmail"
                          type="email"
                          placeholder="john@example.com"
                          value={formData.customerEmail}
                          onChange={handleInputChange}
                          className="pl-10"
                        />
                      </div>
                    </div>}
                  </CardContent>
                </Card>
                {/* Shipping Address */}
                {isDelivery &&
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      محل تحویل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingAddress">آدرس *</Label>
                      <Input
                        id="shippingAddress"
                        name="shippingAddress"
                        placeholder="آدرس کامل محل تحویل"
                        value={formData.shippingAddress}
                        onChange={handleInputChange}
                        required={isDelivery}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">شهر (اختیاری)</Label>
                        <Input
                          id="city"
                          name="city"
                          placeholder="شهرکرد"
                          value={formData.city}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">کد پستی (اختیاری)</Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          placeholder="10001"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                }
                {/* Order Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("order.notes")} ({t("common.optional")})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      id="notes"
                      name="notes"
                      placeholder="اگر دستورالعمل خاصی برای سفارش در نظر دارید ذکر فرمایید ..."
                      value={formData.notes || ""}
                      onChange={handleInputChange}
                      className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background resize-none"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                        {t("order.summary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {item.variant.product.image ? (
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
                          <div className="flex-1 min-w-0 mt-1">
                            <p className=" text-sm truncate">
                               {formatNumber(item.quantity)} x
                              {item.variant.product.name}
                            </p>
                            <p className="text-sm mt-2">
                              {formatToman(item.variant.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">جمع جزئی</span>
                        <span>{formatToman(summary.subtotal)}</span>
                      </div>
                      {isDelivery && <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">پیک</span>
                        <span>...</span>
                      </div>}
                    </div>

                    {/**Payment Method */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">روش پرداخت</span>
                          <Select value={paymentMethod} onValueChange={(value) => {
                            setPaymentMethod(value as "CREDIT_CARD"| "DEBIT_CARD"| "CASH"| "WALLET"| "BANK_TRANSFER")}}>
                            <SelectTrigger className="w-full sm:w-48">
                              <SelectValue placeholder="همه وضعیت‌ها" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(paymentMethodConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  {config.label}
                                </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>                     
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between font-medium text-lg">
                      <span>
                        {t("order.total") || "مجموع"}
                      </span>
                      <span>{formatToman(summary.subtotal)}</span>
                    </div>

                    {error && (
                      <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {t("common.processing")}...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          {t("order.place")}
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      ثبت سفارش نشان دهنده ی موافقت با شرایط  تیم ما می باشد 
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
