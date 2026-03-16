"use client";

import React, { useState, useEffect, use } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGuestCart } from "@/lib/contexts/guest-cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronRight, 
  ShoppingBag, 
  CreditCard, 
  MapPin, 
  User, 
  Phone, 
  Mail,
  Loader2,
  ArrowRight,
  Package,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface CheckoutFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  notes: string;
}

export default function CheckoutPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale;
  const slug = resolvedParams.slug;
  const router = useRouter();

  const { cart, summary, isLoading: cartLoading, clearCart } = useGuestCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>("");

  const [formData, setFormData] = useState<CheckoutFormData>({
    customerName: "",
    customerPhone: "",
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      const response = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ...formData,
          items: cart.items.map(item => ({
            variantId: item.variant.id,
            quantity: item.quantity,
            price: item.variant.price,
          })),
        }),
      });

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
            <CardTitle>Your cart is empty</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>Add some products to your cart before checking out.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link href={`/${locale}/shop/${slug}`}>
              <Button>
                Browse Products
                <ArrowRight className="ml-2 h-4 w-4" />
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
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/${locale}/shop/${slug}`} className="hover:text-foreground">
              {organizationName}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Checkout</span>
          </nav>
        </div>
      </div>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold mb-8">Checkout</h1>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Checkout Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customerName">Full Name *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="customerName"
                            name="customerName"
                            placeholder="John Doe"
                            value={formData.customerName}
                            onChange={handleInputChange}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customerPhone">Phone Number *</Label>
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
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email (Optional)</Label>
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
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="shippingAddress">Street Address *</Label>
                      <Input
                        id="shippingAddress"
                        name="shippingAddress"
                        placeholder="123 Main Street"
                        value={formData.shippingAddress}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          name="city"
                          placeholder="New York"
                          value={formData.city}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code *</Label>
                        <Input
                          id="postalCode"
                          name="postalCode"
                          placeholder="10001"
                          value={formData.postalCode}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Order Notes (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      id="notes"
                      name="notes"
                      placeholder="Any special instructions for your order..."
                      value={formData.notes}
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
                      Order Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {item.variant.product.images[0] ? (
                              <img
                                src={item.variant.product.images[0]}
                                alt={item.variant.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.variant.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.variant.name} × {item.quantity}
                            </p>
                            <p className="text-sm font-medium mt-1">
                              {formatPrice(item.variant.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatPrice(summary.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>Calculated at next step</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between font-medium text-lg">
                      <span>Total</span>
                      <span>{formatPrice(summary.subtotal)}</span>
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
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Place Order
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      By placing this order, you agree to the terms and conditions.
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
