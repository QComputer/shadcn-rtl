"use client"

import * as React from "react"
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useTheme, type Theme } from "@/hooks/use-theme"

interface ThemeSwitcherProps {
  align?: "start" | "center" | "end"
  sideOffset?: number
}

export function ThemeSwitcher({ align = "end", sideOffset = 4 }: ThemeSwitcherProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <SunIcon className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <MoonIcon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <MonitorIcon className="h-4 w-4" /> },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md border-0">
          <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={sideOffset} className="bg-popover text-popover-foreground">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="flex items-center gap-2"
            >
              {option.icon}
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Standalone component for use in forms/settings pages
export function ThemeSelector({
  value,
  onValueChange,
}: {
  value: Theme
  onValueChange: (value: Theme) => void
}) {
  const themeOptions: { value: Theme; label: string; description: string; icon: React.ReactNode }[] = [
    { 
      value: "light", 
      label: "Light", 
      description: "Always use light theme",
      icon: <SunIcon className="h-4 w-4" /> 
    },
    { 
      value: "dark", 
      label: "Dark", 
      description: "Always use dark theme",
      icon: <MoonIcon className="h-4 w-4" /> 
    },
    { 
      value: "system", 
      label: "System", 
      description: "Follow system preference",
      icon: <MonitorIcon className="h-4 w-4" /> 
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      {themeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          className={`
            flex items-center gap-3 rounded-lg border p-3 text-left transition-all
            ${value === option.value 
              ? "border-primary bg-accent" 
              : "border-border hover:bg-muted"}
          `}
        >
          <span className={value === option.value ? "text-primary" : "text-muted-foreground"}>
            {option.icon}
          </span>
          <div>
            <p className="text-sm font-medium">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
