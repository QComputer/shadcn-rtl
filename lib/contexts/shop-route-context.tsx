"use client";

import React, { createContext, useContext } from "react";

type ShopRouteContextValue = {
  productsHref: string;
  checkoutHref: string;
  orderHref: (orderNumber: string) => string;
};

const ShopRouteContext = createContext<ShopRouteContextValue | null>(null);

export function ShopRouteProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ShopRouteContextValue;
}) {
  return (
    <ShopRouteContext.Provider value={value}>
      {children}
    </ShopRouteContext.Provider>
  );
}

export function useShopRoutePaths(fallback: ShopRouteContextValue) {
  return useContext(ShopRouteContext) ?? fallback;
}
