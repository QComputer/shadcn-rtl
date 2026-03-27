"use client"

import * as React from "react"
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme, type Theme, themeNames, themeDescriptions } from "@/hooks/use-theme"

interface ThemeSwitcherProps {
  align?: "start" | "center" | "end"
  sideOffset?: number
}

export function ThemeSwitcher({ align = "start", sideOffset = 4 }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { 
      value: "light", 
      label: themeNames.light, 
      icon: <SunIcon className="h-4 w-4" /> 
    },
    { 
      value: "warm-cream", 
      label: themeNames["warm-cream"], 
      icon: <SunIcon className="h-4 w-4" /> 
    },
    { 
      value: "dark", 
      label: themeNames.dark, 
      icon: <MoonIcon className="h-4 w-4" /> 
    },
    { 
      value: "charcoal-gray", 
      label: themeNames["charcoal-gray"], 
      icon: <MoonIcon className="h-4 w-4" /> 
    },
    { 
      value: "system", 
      label: themeNames.system, 
      icon: <MonitorIcon className="h-4 w-4" /> 
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="h-9 w-9 rounded-md border-0 bg-transparent cursor-pointer flex items-center justify-center hover:bg-accent hover:text-accent-foreground rounded-md">
        <SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">تغییر تم</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={sideOffset} className="bg-popover text-popover-foreground">
        <DropdownMenuGroup>
          <DropdownMenuLabel>انتخاب تم</DropdownMenuLabel>
        </DropdownMenuGroup>
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
      label: themeNames.light, 
      description: themeDescriptions.light,
      icon: <SunIcon className="h-4 w-4" /> 
    },
    { 
      value: "warm-cream", 
      label: themeNames["warm-cream"], 
      description: themeDescriptions["warm-cream"],
      icon: <SunIcon className="h-4 w-4" /> 
    },
    { 
      value: "dark", 
      label: themeNames.dark, 
      description: themeDescriptions.dark,
      icon: <MoonIcon className="h-4 w-4" /> 
    },
    { 
      value: "charcoal-gray", 
      label: themeNames["charcoal-gray"], 
      description: themeDescriptions["charcoal-gray"],
      icon: <MoonIcon className="h-4 w-4" /> 
    },
    { 
      value: "system", 
      label: themeNames.system, 
      description: themeDescriptions.system,
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
            flex items-center gap-3 rounded-lg border p-3 text-right transition-all
            ${value === option.value 
              ? "border-primary bg-accent" 
              : "border-border hover:bg-muted"}
          `}
        >
          <span className={value === option.value ? "text-primary" : "text-muted-foreground"}>
            {option.icon}
          </span>
          <div className="text-right">
            <p className="text-sm font-medium">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
