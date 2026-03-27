"use client";
// TODO: Make it the unified cart-context for both registered and guest users
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Types
export interface CartItem {
  id: string;
  quantity: number;
  variant: {
    id: string;
    name: string;
    price: number;
    sku: string | null;
    product: {
      id: string;
      name: string;
      images: string[];
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

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: React.ReactNode;
  organizationId: string;
}

export function CartProvider({ children, organizationId }: CartProviderProps) {
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
      (sum, item) => sum + item.variant.price * item.quantity,
      0
    );
    
    return { itemCount, subtotal };
  }, [cart]);

  // Fetch cart
  const refreshCart = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/cart?organizationId=${organizationId}`);
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
  }, [organizationId]);

  // Load cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Add to cart
  const addToCart = useCallback(async (variantId: string, quantity: number = 1) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
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
  }, [organizationId, refreshCart, router]);

  // Update quantity
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PUT",
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
      const response = await fetch(`/api/cart/items/${itemId}`, {
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
      const response = await fetch(`/api/cart?organizationId=${organizationId}`, {
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
  }, [organizationId, router]);

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
