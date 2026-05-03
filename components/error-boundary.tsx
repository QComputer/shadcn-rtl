"use client"

import { Component, type ReactNode, type ErrorInfo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">خطایی رخ داد</CardTitle>
              <CardDescription className="text-center">
                متأسفانه مشکلی پیش آمده است
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground text-center">
                  {this.state.error?.message || "خطای ناشناخته رخ داد"}
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={this.handleReset} 
                  className="w-full"
                >
                  <RefreshCw className="ml-2 h-4 w-4" />
                  تلاش مجدد
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/dashboard"}
                    className="flex-1"
                  >
                    <Home className="ml-2 h-4 w-4" />
                    داشبورد
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = "/"}
                    className="flex-1"
                  >
                    <Home className="ml-2 h-4 w-4" />
                    خانه
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                اگر این مشکل ادامه دارد، با پشتیبانی تماس بگیرید
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for handling errors in components
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)

  const handleError = (err: Error | string) => {
    const error = typeof err === "string" ? new Error(err) : err
    setError(error)
    console.error("Error caught by handler:", error)
  }

  const clearError = () => {
    setError(null)
  }

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return { error, handleError, clearError }
}
