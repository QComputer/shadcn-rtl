"use client";
import { createContext, useContext, type CSSProperties } from "react";

export const RetailBrandContext = createContext<CSSProperties | undefined>(undefined);
export function useRetailBrandStyle() { return useContext(RetailBrandContext); }
