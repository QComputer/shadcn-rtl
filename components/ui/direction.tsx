"use client"

import * as React from "react"

export type Direction = "rtl" | "ltr"

interface DirectionContextValue {
  direction: Direction
  setDirection: (direction: Direction) => void
  isRTL: boolean
}

const DirectionContext = React.createContext<DirectionContextValue | undefined>(undefined)

interface DirectionProviderProps {
  children: React.ReactNode
  defaultDirection?: Direction
  storageKey?: string
}

export function DirectionProvider({
  children,
  defaultDirection = "rtl",
  storageKey = "shadcn-rtl-direction",
}: DirectionProviderProps) {
  const [direction, setDirectionState] = React.useState<Direction>(() => {
    if (typeof window === "undefined") {
      return defaultDirection
    }
    return (localStorage.getItem(storageKey) as Direction) || defaultDirection
  })

  React.useEffect(() => {
    const root = window.document.documentElement
    root.setAttribute("dir", direction)
    root.setAttribute("lang", direction === "rtl" ? "fa" : "en")
  }, [direction])

  const setDirection = React.useCallback((newDirection: Direction) => {
    setDirectionState(newDirection)
    localStorage.setItem(storageKey, newDirection)
  }, [storageKey])

  const isRTL = direction === "rtl"

  return (
    <DirectionContext.Provider value={{ direction, setDirection, isRTL }}>
      {children}
    </DirectionContext.Provider>
  )
}

export function useDirection() {
  const context = React.useContext(DirectionContext)
  if (context === undefined) {
    throw new Error("useDirection must be used within a DirectionProvider")
  }
  return context
}

export function useIsRTL() {
  const { isRTL } = useDirection()
  return isRTL
}

// Toggle component for switching between RTL and LTR
export function DirectionToggle({
  className,
}: {
  className?: string
}) {
  const { direction, setDirection } = useDirection()

  return (
    <button
      onClick={() => setDirection(direction === "rtl" ? "ltr" : "rtl")}
      className={className}
      title={direction === "rtl" ? "تغییر به چپ به راست" : "تغییر به راست به چپ"}
    >
      {direction === "rtl" ? "RTL" : "LTR"}
    </button>
  )
}
