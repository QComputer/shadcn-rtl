"use client";
// TODO: Make it the unified cart-context for both registered and guest users
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/app-base-path";

// Types
export interface CartItem {
  id: string;
  quantity: number;
  variant: {
    id: string;
    name: string | null;
    price: number | string | null;
    sku: string | null;
    product: {
      id: string;
      name: string;
      image: string | null;  
      images: string[];
      basePrice: number | string;
      discountType: "none" | "percentage" | "fixed" | string | null;
      discountValue: number | string | null;
    };
  };
}

export interface ShopCart {
  id: string;
  customerId?: string
  guestCustomerId?: string
  sessionId?: string
  items: CartItem[];
  expiresAt?: string;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
}

interface CartContextType {
  cart: ShopCart | null;
  isLoading: boolean;
  error: string | null;
  summary: CartSummary;
  addToCart: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}


function toMoneyNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCartItemUnitPrice(item: CartItem): number {
  const basePrice = toMoneyNumber(item.variant.price ?? item.variant.product.basePrice);
  
  // Apply product discount if present
  const product = item.variant.product;
  const productDiscountType = product.discountType;
  const productDiscountValue = toMoneyNumber(product.discountValue);
  
  if (productDiscountType === "percentage" && productDiscountValue > 0) {
    // For percentage discount, discountValue is the percentage to subtract
    // e.g., 20 means 20% off, so price = basePrice * 0.8
    return basePrice * (1 - productDiscountValue / 100);
  }
  
  if (productDiscountType === "fixed" && productDiscountValue > 0) {
    // For fixed discount, discountValue is subtracted from basePrice
    return Math.max(0, basePrice - productDiscountValue);
  }
  
  return basePrice;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: React.ReactNode;
  locale?: string;
  slug?: string;
}

export function CartProvider({ children, slug, locale }: CartProviderProps) {
  const [cart, setCart] = useState<ShopCart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Calculate summary
  const summary: CartSummary = React.useMemo(() => {
    if (!cart || !cart.items) {
      return { itemCount: 0, subtotal: 0 };
    }
    
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.items.reduce(
      (sum, item) => sum + getCartItemUnitPrice(item) * item.quantity,
      0
    );
    
    return { itemCount, subtotal };
  }, [cart]);

  // Fetch cart
  const refreshCart = useCallback(async () => {
    if (!slug) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(appPath(`/api/cart?organizationSlug=${slug}`));
      if (!response.ok) {
        throw new Error("Failed to fetch cart");
      }
      const data = await response.json();
      setCart(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cart");
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Load cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Add to cart
  const addToCart = useCallback(async (variantId: string, quantity: number = 1) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(appPath("/api/cart"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: slug,
          variantId,
          quantity,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add to cart");
      }
      
      // Refresh cart after adding
      await refreshCart();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [slug, refreshCart, router]);

  // Update quantity
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(appPath(`/api/cart/items/${itemId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update quantity");
      }
      
      await refreshCart();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quantity");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCart, router]);

  // Remove item
  const removeItem = useCallback(async (itemId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(appPath(`/api/cart/items/${itemId}`), {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove item");
      }
      
      await refreshCart();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCart, router]);

  // Clear cart
  const clearCart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(appPath(`/api/cart?organizationSlug=${slug}`), {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to clear cart");
      }
      
      setCart(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear cart");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [slug, router]);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        error,
        summary,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
