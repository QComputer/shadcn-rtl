"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/lib/contexts/cart-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, ShoppingCart, ShoppingBasket } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface CartDrawerProps {
  organizationSlug: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function CartDrawer({ organizationSlug, trigger, open, onOpenChange, children }: CartDrawerProps) {
  const { cart, isLoading, summary, updateQuantity, removeItem } = useCart();
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setUpdatingId(itemId);
    try {
      await updateQuantity(itemId, newQuantity);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    setUpdatingId(itemId);
    try {
      await removeItem(itemId);
    } finally {
      setUpdatingId(null);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="icon" className="relative">
      <ShoppingCart className="h-5 w-5" />
      {summary.itemCount > 0 && (
        <span className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
          {summary.itemCount}
        </span>
      )}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children || trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col ">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 mt-20">
            <ShoppingCart className="h-5 w-5 " />
            سبد خرید
            {summary.itemCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({summary.itemCount} {summary.itemCount === 1 ? "item" : "items"})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading && !cart ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cart?.items?.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <ShoppingBasket className="h-16 w-16 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium">سبد خرید شما خالی است</p>
              <p className="text-sm text-muted-foreground">
                برای شروع چند محصول اضلافه کنید
              </p>
            </div>
            <Link href={`/shop/${organizationSlug}`}>
              <Button>محصولات ما را ببینید</Button>
            </Link>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {cart?.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 rounded-lg border bg-card"
                  >
                    {/* Product Image */}
                    <div className="h-20 w-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.variant.product.images[0] ? (
                        <img
                          src={item.variant.product.images[0]}
                          alt={item.variant.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {item.variant.product.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {item.variant.name}
                        {item.variant.sku && ` • ${item.variant.sku}`}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        {formatPrice(item.variant.price)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border rounded-md">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={updatingId === item.id || item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">
                            {updatingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                            ) : (
                              item.quantity
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={updatingId === item.id}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemove(item.id)}
                          disabled={updatingId === item.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="font-medium">
                        {formatPrice(item.variant.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Cart Footer */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between text-lg font-medium">
                <span>جمع جزئی</span>
                <span>{formatPrice(summary.subtotal)}</span>
              </div>
              <div className="grid gap-2">
                <Link href={`/shop/${organizationSlug}/checkout`}>
                  <Button className="w-full" size="lg">
                    ادامه برای بررسی و تایید
                  </Button>
                </Link>
                <Link href={`/shop/${organizationSlug}`}>
                  <Button variant="outline" className="w-full">
                    ادامه خرید 
                  </Button>
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
