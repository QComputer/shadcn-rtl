"use client";

import React, { createContext, useContext } from "react";

type ShopRouteContextValue = {
  productsHref: string;
  checkoutHref: string;
  orderHref: (orderNumber: string) => string;
};

type ShopRouteProviderValue = {
  productsHref: string;
  checkoutHref: string;
  orderHrefPrefix: string;
};

const ShopRouteContext = createContext<ShopRouteContextValue | null>(null);

export function ShopRouteProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ShopRouteProviderValue;
}) {
  const resolvedValue = React.useMemo<ShopRouteContextValue>(
    () => ({
      productsHref: value.productsHref,
      checkoutHref: value.checkoutHref,
      orderHref: (orderNumber: string) => `${value.orderHrefPrefix}${orderNumber}`,
    }),
    [value.checkoutHref, value.orderHrefPrefix, value.productsHref],
  );

  return (
    <ShopRouteContext.Provider value={resolvedValue}>
      {children}
    </ShopRouteContext.Provider>
  );
}

export function useShopRoutePaths(fallback: ShopRouteContextValue) {
  return useContext(ShopRouteContext) ?? fallback;
}
