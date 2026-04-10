"use client";

import React, { useState } from "react";
import { useCart } from "@/lib/contexts/cart-context";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddProductToCartButtonProps {
  productId: string;
  productName?: string;
  quantity?: number;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddProductToCartButton({
  productId,
  productName,
  quantity = 1,
  className,
  size = "default",
  showIcon = true,
  children,
  onSuccess,
}: AddProductToCartButtonProps) {
  const { addToCart, isLoading } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addToCart(productId, quantity);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const isDisabled = isLoading || isAdding;

  return (
    <Button
      onClick={handleAddToCart}
      disabled={isDisabled}
      size={size}
      className={cn(className)}
    >
      {isAdding ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Adding...
        </>
      ) : showSuccess ? (
        <>
          <Check className="h-4 w-4" />
          Added!
        </>
      ) : (
        <>
          {showIcon && <ShoppingCart className="h-4 w-4" />}
          {children || "Add to Cart"}
        </>
      )}
    </Button>
  );
}
