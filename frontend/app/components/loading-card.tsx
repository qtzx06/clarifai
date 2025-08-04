"use client"

import { LoadingSpinner } from './loading-spinner'

interface LoadingCardProps {
  title?: string
  message?: string
  showSpinner?: boolean
  className?: string
  children?: React.ReactNode
}

export function LoadingCard({ 
  title = "Loading", 
  message, 
  showSpinner = true, 
  className = "",
  children 
}: LoadingCardProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative bg-slate-100 rounded-lg flex items-center justify-center p-8 min-h-[280px]">
        <div className="text-center text-slate-500">
          {showSpinner && (
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <LoadingSpinner size="lg" />
            </div>
          )}
          <p className="text-sm font-medium">
            {title}
          </p>
          {message && !children && (
            <p className="text-xs text-slate-400 mt-1">
              {message}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

// Skeleton loading for text content
export function LoadingSkeleton({ 
  lines = 3, 
  className = "" 
}: { 
  lines?: number
  className?: string
}) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-slate-200 rounded ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  )
}

// Progress bar component for detailed loading states
export function LoadingProgress({ 
  progress = 0, 
  message,
  className = "",
  variant = "default"
}: { 
  progress?: number
  message?: string
  className?: string
  variant?: "default" | "animated"
}) {
  const barStyle = variant === "animated"
    ? "bg-gradient-to-r from-blue-600 to-purple-600 animated-gradient"
    : "bg-slate-500";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ease-out ${barStyle}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-slate-500 text-center">
          {message}
        </p>
      )}
    </div>
  )
}