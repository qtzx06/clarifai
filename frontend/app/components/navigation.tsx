'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function Navigation() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-accent-border backdrop-blur-md bg-bg-primary/80"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold hover:text-text-secondary transition-colors">
          ClarifAI
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/papers"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Papers
          </Link>
          <Link
            href="/"
            className="btn-primary text-sm"
          >
            Upload
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
