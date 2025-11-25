'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, User, Video } from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import { getUsageStats, UsageStats } from '../lib/api';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const { user, loading, signIn, signOut } = useAuth();
  const router = useRouter();

  // Fetch usage stats when user is logged in
  useEffect(() => {
    if (user) {
      getUsageStats()
        .then(setUsageStats)
        .catch((error) => {
          console.error('Failed to fetch usage stats:', error);
        });
      
      // Refresh stats every 30 seconds
      const interval = setInterval(() => {
        getUsageStats()
          .then(setUsageStats)
          .catch((error) => {
            console.error('Failed to fetch usage stats:', error);
          });
      }, 30000);
      
      return () => clearInterval(interval);
    } else {
      setUsageStats(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still redirect even if there's an error
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {/* Desktop: Floating Pill Nav - Centered */}
      <div className="fixed top-6 left-0 right-0 z-50 hidden md:flex justify-center pointer-events-none">
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
          className="pointer-events-auto"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 backdrop-blur-2xl shadow-glow">
          <Link
            href="/"
            className="px-4 py-1.5 text-sm font-light tracking-tight text-white transition-colors hover:text-text-secondary rounded-full hover:bg-white/5"
          >
          ClarifAI
        </Link>
          <div className="h-4 w-px bg-white/20" />
          <Link
            href="/papers"
            className="px-4 py-1.5 text-sm text-text-secondary hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            Library
          </Link>
          <Link
            href="/"
            className="ml-1 px-5 py-1.5 text-sm font-medium text-white bg-white/15 border border-white/25 rounded-full transition-all duration-300 hover:bg-white/20 hover:border-white/35 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:-translate-y-0.5"
          >
            Upload
          </Link>
          {!loading && (
            <>
              <div className="h-4 w-px bg-white/20" />
              {user ? (
                <>
                  {usageStats && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-white/10 rounded-full bg-white/5">
                      <Video className="w-3.5 h-3.5" />
                      <span className="whitespace-nowrap">
                        {usageStats.remaining_today}/{usageStats.daily_limit} videos
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary">
                    <User className="w-3.5 h-3.5" />
                    <span className="max-w-[120px] truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-4 py-1.5 text-sm text-text-secondary hover:text-white transition-colors rounded-full hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sign out"
                  >
                    {isSigningOut ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-1.5 text-sm text-text-secondary hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
        </motion.nav>
      </div>

      {/* Mobile: Hamburger Button - Top Right */}
      <motion.button
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="md:hidden fixed top-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full border border-white/15 bg-white/5 backdrop-blur-2xl shadow-glow transition-all duration-300 hover:bg-white/10 hover:border-white/25"
        aria-label="Toggle menu"
      >
        {isMenuOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Menu className="w-5 h-5 text-white" />
        )}
      </motion.button>

      {/* Mobile: Slide-out Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Side Menu */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-80 border-l border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl md:hidden"
            >
              <div className="flex flex-col h-full p-8">
                <div className="flex items-center justify-between mb-12">
                  <Link
                    href="/"
                    onClick={() => setIsMenuOpen(false)}
                    className="text-xl font-semibold tracking-tight text-white"
                  >
                    ClarifAI
                  </Link>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                <nav className="flex flex-col gap-4 flex-1">
                  <Link
                    href="/"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <span className="text-sm font-medium">Upload Paper</span>
                  </Link>
                  <Link
                    href="/papers"
                    onClick={() => setIsMenuOpen(false)}
                    className="px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <span className="text-sm font-medium">Library</span>
                  </Link>
                  
                  {!loading && (
                    <div className="mt-auto pt-6 border-t border-white/10">
                      {user ? (
                        <>
                          {usageStats && (
                            <div className="px-6 py-3 mb-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3">
                              <Video className="w-4 h-4 text-text-secondary" />
                              <div className="flex-1">
                                <div className="text-sm text-text-secondary">
                                  {usageStats.remaining_today} of {usageStats.daily_limit} videos remaining today
                                </div>
                                {usageStats.currently_generating > 0 && (
                                  <div className="text-xs text-text-tertiary mt-0.5">
                                    {usageStats.currently_generating} generating
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="px-6 py-3 mb-3 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3">
                            <User className="w-4 h-4 text-text-secondary" />
                            <span className="text-sm text-text-secondary truncate">{user.email}</span>
                          </div>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setIsMenuOpen(false);
                            }}
                            disabled={isSigningOut}
                            className="w-full px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSigningOut ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <LogOut className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
                          </button>
                        </>
                      ) : (
                        <Link
                          href="/login"
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-text-primary hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center"
                        >
                          <span className="text-sm font-medium">Sign in</span>
                        </Link>
                      )}
                    </div>
                  )}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
