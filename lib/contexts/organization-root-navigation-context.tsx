"use client";

import { createContext, useContext } from "react";

export type OrganizationRootNavigation = {
  href: string;
  mode: "hard" | "next";
};

const defaultNavigation: OrganizationRootNavigation = { href: "/", mode: "next" };
const OrganizationRootNavigationContext = createContext(defaultNavigation);

export function OrganizationRootNavigationProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: OrganizationRootNavigation;
}) {
  return (
    <OrganizationRootNavigationContext.Provider value={value}>
      {children}
    </OrganizationRootNavigationContext.Provider>
  );
}

export function useOrganizationRootNavigation() {
  return useContext(OrganizationRootNavigationContext);
}
