'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Check if Supabase is configured
  const isSupabaseConfigured = typeof window !== 'undefined' && 
    process.env.NEXT_PUBLIC_SUPABASE_URL && 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    // If Supabase is not configured, skip auth
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Supabase auth error:', error)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((error) => {
      console.warn('Failed to get Supabase session:', error)
      setLoading(false)
    })

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [isSupabaseConfigured])

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured. Cannot sign in.')
      throw new Error('Supabase is not configured')
    }
    try {
      // Use environment variable for site URL if available, otherwise use current origin
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const redirectTo = `${siteUrl}/papers`
      
      console.log('[AUTH] Signing in with redirect URL:', redirectTo)
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
        },
      })
      if (error) {
        throw error
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      // Re-throw with a more helpful message
      if (error?.message?.includes('provider is not enabled') || error?.code === 400) {
        throw new Error('Google OAuth is not enabled in Supabase. Please enable it in your Supabase dashboard under Authentication → Providers → Google.')
      }
      throw error
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      // In dev mode without Supabase, just clear local state
      setUser(null)
      return
    }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        // Still clear user state even if there's an error
        setUser(null)
        throw error
      }
      // User state will be updated by onAuthStateChange listener
    } catch (error) {
      console.error('Sign out failed:', error)
      // Clear user state anyway
      setUser(null)
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
