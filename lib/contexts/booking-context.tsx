"use client"

import { createContext, useContext, useReducer, useEffect, ReactNode } from "react"

// Types
interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  image: string | null
  categoryId: string
  category: {
    id: string
    name: string
  }
  serviceProvider: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface BookingSettings {
  slotDuration: number
  bufferBefore: number
  bufferAfter: number
  minBookingNotice: number
  maxBookingAdvance: number
  maxAppointmentsPerDay: number | null
  allowCancellation: boolean
  cancellationDeadline: number
  requirePhone: boolean
  requireEmail: boolean
  requireName: boolean
  autoConfirm: boolean
}

interface BookingState {
  // Current step
  step: "service" | "datetime" | "details" | "confirm" | "success"
  
  // Selected items
  selectedService: Service | null
  selectedDate: Date | null
  selectedTime: string | null
  selectedStaffId: string | null
  
  // Customer details
  customerName: string
  customerPhone: string
  customerEmail: string
  notes: string
  
  // Booking result
  bookingId: string | null
  bookingReference: string | null
  
  // Settings
  settings: BookingSettings | null
  
  // Loading states
  loadingSlots: boolean
  submitting: boolean
  
  // Available slots
  availableSlots: string[]
  
  // Errors
  error: string | null
}

type BookingAction =
  | { type: "SET_STEP"; payload: BookingState["step"] }
  | { type: "SET_SERVICE"; payload: Service | null }
  | { type: "SET_DATE"; payload: Date | null }
  | { type: "SET_TIME"; payload: string | null }
  | { type: "SET_STAFF"; payload: string | null }
  | { type: "SET_CUSTOMER_NAME"; payload: string }
  | { type: "SET_CUSTOMER_PHONE"; payload: string }
  | { type: "SET_CUSTOMER_EMAIL"; payload: string }
  | { type: "SET_NOTES"; payload: string }
  | { type: "SET_SETTINGS"; payload: BookingSettings }
  | { type: "SET_LOADING_SLOTS"; payload: boolean }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_AVAILABLE_SLOTS"; payload: string[] }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_BOOKING_RESULT"; payload: { bookingId: string; bookingReference: string | null } }
  | { type: "RESET" }
  | { type: "LOAD_FROM_STORAGE"; payload: Partial<BookingState> }

const initialState: BookingState = {
  step: "service",
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
  selectedStaffId: null,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  notes: "",
  bookingId: null,
  bookingReference: null,
  settings: null,
  loadingSlots: false,
  submitting: false,
  availableSlots: [],
  error: null,
}

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload }
    case "SET_SERVICE":
      return { ...state, selectedService: action.payload, selectedTime: null, availableSlots: [] }
    case "SET_DATE":
      return { ...state, selectedDate: action.payload, selectedTime: null }
    case "SET_TIME":
      return { ...state, selectedTime: action.payload }
    case "SET_STAFF":
      return { ...state, selectedStaffId: action.payload }
    case "SET_CUSTOMER_NAME":
      return { ...state, customerName: action.payload }
    case "SET_CUSTOMER_PHONE":
      return { ...state, customerPhone: action.payload }
    case "SET_CUSTOMER_EMAIL":
      return { ...state, customerEmail: action.payload }
    case "SET_NOTES":
      return { ...state, notes: action.payload }
    case "SET_SETTINGS":
      return { ...state, settings: action.payload }
    case "SET_LOADING_SLOTS":
      return { ...state, loadingSlots: action.payload }
    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload }
    case "SET_AVAILABLE_SLOTS":
      return { ...state, availableSlots: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_BOOKING_RESULT":
      return { 
        ...state, 
        bookingId: action.payload.bookingId, 
        bookingReference: action.payload.bookingReference,
        step: "success"
      }
    case "RESET":
      return { ...initialState, settings: state.settings }
    case "LOAD_FROM_STORAGE":
      return { ...state, ...action.payload }
    default:
      return state
  }
}

// Context
interface BookingContextType {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
  // Helper functions
  nextStep: () => void
  prevStep: () => void
  canProceed: () => boolean
  resetBooking: () => void
  saveToStorage: () => void
}

const BookingContext = createContext<BookingContextType | null>(null)

// Provider
interface BookingProviderProps {
  children: ReactNode
  organizationSlug: string
  initialServiceId?: string
  initialStaffId?: string
}

export function BookingProvider({ 
  children, 
  organizationSlug,
  initialServiceId,
  initialStaffId 
}: BookingProviderProps) {
  const [state, dispatch] = useReducer(bookingReducer, {
    ...initialState,
    selectedStaffId: initialStaffId || null,
  })

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`booking_state_${organizationSlug}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Only load if not expired (24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          dispatch({ 
            type: "LOAD_FROM_STORAGE", 
            payload: {
              customerName: parsed.customerName || "",
              customerPhone: parsed.customerPhone || "",
              customerEmail: parsed.customerEmail || "",
            }
          })
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [organizationSlug])

  // Save customer details to localStorage
  const saveToStorage = () => {
    localStorage.setItem(`booking_state_${organizationSlug}`, JSON.stringify({
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      customerEmail: state.customerEmail,
      timestamp: Date.now(),
    }))
    // Also save phone separately for appointment lookup
    if (state.customerPhone) {
      localStorage.setItem(`booking_phone_${organizationSlug}`, state.customerPhone)
    }
  }

  const nextStep = () => {
    const steps: BookingState["step"][] = ["service", "datetime", "details", "confirm"]
    const currentIndex = steps.indexOf(state.step)
    if (currentIndex < steps.length - 1) {
      dispatch({ type: "SET_STEP", payload: steps[currentIndex + 1] })
    }
  }

  const prevStep = () => {
    const steps: BookingState["step"][] = ["service", "datetime", "details", "confirm"]
    const currentIndex = steps.indexOf(state.step)
    if (currentIndex > 0) {
      dispatch({ type: "SET_STEP", payload: steps[currentIndex - 1] })
    }
  }

  const canProceed = () => {
    switch (state.step) {
      case "service":
        return state.selectedService !== null
      case "datetime":
        return state.selectedDate !== null && state.selectedTime !== null
      case "details":
        const hasName = state.customerName.trim().length >= 2
        const hasPhone = state.customerPhone.trim().length >= 10
        const emailValid = !state.settings?.requireEmail || state.customerEmail.includes("@")
        return hasName && hasPhone && emailValid
      case "confirm":
        return true
      default:
        return false
    }
  }

  const resetBooking = () => {
    dispatch({ type: "RESET" })
  }

  return (
    <BookingContext.Provider value={{ 
      state, 
      dispatch, 
      nextStep, 
      prevStep, 
      canProceed, 
      resetBooking,
      saveToStorage 
    }}>
      {children}
    </BookingContext.Provider>
  )
}

// Hook
export function useBooking() {
  const context = useContext(BookingContext)
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider")
  }
  return context
}

// Export types
export type { BookingState, BookingSettings, Service }
