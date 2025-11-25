'use client'

import { useAuth } from '../providers/auth-provider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Navigation } from '../components/navigation'
import { ShaderCanvas } from '../components/shader-canvas'
import { isSupabaseConfigured } from '../lib/supabase'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      router.push('/papers')
    }
  }, [user, router])

  const handleSignIn = async () => {
    setError(null)
    setIsSigningIn(true)
    try {
      await signIn()
    } catch (err: any) {
      console.error('Sign in error:', err)
      setError(err?.message || 'Failed to sign in. Please try again.')
      setIsSigningIn(false)
    }
  }

  const supabaseConfigured = isSupabaseConfigured()

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-primary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-text-primary">
      <div className="fixed inset-0 bg-bg-primary -z-10" />
      <div className="fixed inset-0" style={{ zIndex: 0 }}>
        <ShaderCanvas className="w-full h-full pointer-events-none" introDuration={1.0} />
      </div>
      <div className="fixed inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60 pointer-events-none" style={{ zIndex: 1 }} />

      <Navigation />

      <main className="relative z-10 min-h-screen flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/20 bg-black/40 backdrop-blur-3xl shadow-2xl p-12">
            <div className="text-center mb-10">
              <h1 className="text-[clamp(2rem,4vw,2.5rem)] font-light leading-tight tracking-[-0.04em] mb-4">
                Welcome to <span className="text-white">ClarifAI</span>
              </h1>
              <p className="text-text-secondary text-lg">
                Sign in to continue
              </p>
            </div>

            <div>
              {!supabaseConfigured && (
                <div className="mb-4 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 backdrop-blur-xl">
                  <p className="text-sm text-yellow-200">
                    Supabase is not configured. Sign in is disabled. Add <code className="text-xs bg-black/20 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-xs bg-black/20 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable authentication.
                  </p>
                </div>
              )}
              
              <button
                onClick={handleSignIn}
                disabled={!supabaseConfigured || isSigningIn}
                className="w-full group relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl px-6 py-4 text-white font-light transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10"
              >
                {isSigningIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
              
              {error && (
                <div className="mt-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-xl">
                  <p className="text-sm text-red-200 mb-2">{error}</p>
                  {error.includes('Google OAuth is not enabled') && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <p className="text-xs text-red-300/80 mb-2">To enable Google OAuth:</p>
                      <ol className="text-xs text-red-300/70 space-y-1 list-decimal list-inside">
                        <li>Go to your Supabase Dashboard</li>
                        <li>Navigate to Authentication → Providers</li>
                        <li>Click on "Google" provider</li>
                        <li>Enable the provider and add your Google OAuth credentials</li>
                        <li>Add redirect URL: <code className="bg-black/20 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/papers</code></li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-text-tertiary">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-sm font-light text-text-secondary mb-4">Free tier includes:</p>
              <ul className="space-y-2 text-sm text-text-tertiary">
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-1">•</span>
                  <span>5 video generations per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-1">•</span>
                  <span>Unlimited paper uploads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-1">•</span>
                  <span>AI-powered concept extraction</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-white/40 mt-1">•</span>
                  <span>3Blue1Brown-style animations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
