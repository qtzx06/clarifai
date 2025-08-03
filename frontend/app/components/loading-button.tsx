"use client"

import { LoadingSpinner } from './loading-spinner'

interface LoadingButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
  className?: string
  loadingText?: string
}

export function LoadingButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "outline",
  size = "sm",
  className = "",
  loadingText
}: LoadingButtonProps) {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
  
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: loading 
      ? "border border-slate-300 bg-slate-100 text-slate-500" 
      : "border border-input hover:bg-accent hover:text-accent-foreground",
    ghost: loading
      ? "bg-slate-100 text-slate-500"
      : "hover:bg-accent hover:text-accent-foreground"
  }
  
  const sizeClasses = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3"
  }
  
  const isDisabled = disabled || loading

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" className="mr-2" />
          {loadingText || '...'}
        </>
      ) : (
        children
      )}
    </button>
  )
}