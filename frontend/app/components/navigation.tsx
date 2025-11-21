'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            className="ml-1 px-5 py-1.5 text-sm font-medium text-black bg-white rounded-full transition-all duration-300 hover:shadow-[0_20px_45px_rgba(255,255,255,0.25)] hover:-translate-y-0.5"
          >
            Upload
          </Link>
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

                <nav className="flex flex-col gap-4">
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
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
