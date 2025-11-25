/**
 * Supabase client configuration for authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Get Supabase URL and key from environment variables
// Use typeof window check to ensure we're in browser context during build
const getSupabaseUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  }
  // During SSR/build, return empty to avoid creating invalid client
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

const getSupabaseKey = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

// Use a valid Supabase-like URL format for placeholder (must be valid HTTP/HTTPS URL)
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Create Supabase client - lazy initialization to avoid build-time errors
let supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = getSupabaseUrl()?.trim() || ''
  const supabaseAnonKey = getSupabaseKey()?.trim() || ''
  
  // Strict validation: URL must be valid HTTPS and key must be a proper JWT-like string
  // Treat empty strings, null, undefined, or invalid formats as invalid
  const isValidUrl = supabaseUrl && 
    typeof supabaseUrl === 'string' &&
    supabaseUrl.length > 10 &&
    supabaseUrl.startsWith('https://') && 
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey && 
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 20 &&
    supabaseAnonKey.startsWith('eyJ') && // JWT tokens start with 'eyJ'
    !supabaseAnonKey.includes('placeholder')

  // Always use placeholder if validation fails (including empty strings)
  if (!isValidUrl) {
    try {
      supabaseClient = createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY)
      return supabaseClient
    } catch (error) {
      // This should never happen, but if it does, throw a clear error
      throw new Error(`Failed to create Supabase placeholder client: ${error}`)
    }
  }

  // Only create real client if validation passed
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    // If client creation fails for any reason, fall back to placeholder
    console.warn('[SUPABASE] Failed to create client with provided credentials, using placeholder:', error)
    supabaseClient = createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY)
  }
  
  return supabaseClient
}

// Export a getter that creates client on first access (client-side only)
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient]
  }
})

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  // Directly read from process.env to ensure we get the actual values
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  
  // Use the same strict validation as getSupabaseClient()
  const isValid = supabaseUrl && 
    typeof supabaseUrl === 'string' &&
    supabaseUrl.length > 10 &&
    supabaseUrl.startsWith('https://') && 
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey && 
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 20 &&
    supabaseAnonKey.startsWith('eyJ') && // JWT tokens start with 'eyJ'
    !supabaseAnonKey.includes('placeholder')
  
  // Debug logging (only in browser to avoid build errors)
  if (typeof window !== 'undefined') {
    console.log('[SUPABASE] isSupabaseConfigured check:', {
      hasUrl: !!supabaseUrl,
      urlLength: supabaseUrl.length,
      urlStartsWithHttps: supabaseUrl.startsWith('https://'),
      hasKey: !!supabaseAnonKey,
      keyLength: supabaseAnonKey.length,
      keyStartsWithEyJ: supabaseAnonKey.startsWith('eyJ'),
      isValid
    })
  }
  
  return isValid
}

/**
 * Get the current session token for API requests
 * @returns JWT token or null if not authenticated
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    console.log('[SUPABASE] getSessionToken: Checking session...');
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('[SUPABASE] getSessionToken: Error:', error);
      return null;
    }
    if (data.session) {
      console.log('[SUPABASE] getSessionToken: Session found, token length:', data.session.access_token?.length || 0);
      return data.session.access_token || null;
    } else {
      console.log('[SUPABASE] getSessionToken: No session found');
      return null;
    }
  } catch (error) {
    console.error('[SUPABASE] getSessionToken: Exception:', error)
    return null
  }
}

/**
 * Check if user is currently authenticated
 * @returns true if user has active session
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Sign in with Google OAuth
 * @param redirectTo Optional redirect URL after successful login
 */
export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  // Use environment variable for site URL if available, otherwise use current origin
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const finalRedirectTo = redirectTo || `${siteUrl}/papers`
  
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: finalRedirectTo,
    },
  })
}
