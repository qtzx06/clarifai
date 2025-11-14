'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Clock, Search } from 'lucide-react';
import { Navigation } from '../components/navigation';
import { StatusBadge } from '../components/status-badge';

// Mock data for now - in production, fetch from API
interface PaperItem {
  id: string;
  title: string;
  authors: string[];
  uploaded_at: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'error';
  concept_count?: number;
  video_count?: number;
}

export default function PapersPage() {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading papers from localStorage or API
    const loadPapers = () => {
      try {
        const savedPapers = localStorage.getItem('papers');
        if (savedPapers) {
          setPapers(JSON.parse(savedPapers));
        }
      } catch (error) {
        console.error('Failed to load papers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPapers();
  }, []);

  const filteredPapers = papers.filter((paper) =>
    paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    paper.authors.some((author) => author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navigation />

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold mb-2">Papers</h1>
            <p className="text-text-secondary">Your research paper library</p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search papers by title or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-secondary border border-accent-border rounded-lg pl-12 pr-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-text-primary transition-colors"
              />
            </div>
          </motion.div>

          {/* Papers List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center py-16"
            >
              <FileText className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No papers yet</h3>
              <p className="text-text-secondary mb-6">
                {searchQuery ? 'No papers match your search.' : 'Upload your first research paper to get started.'}
              </p>
              {!searchQuery && (
                <Link href="/" className="btn-primary inline-block">
                  Upload Paper
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {filteredPapers.map((paper, index) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link href={`/papers/${paper.id}`}>
                    <div className="card card-hover cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-semibold">
                              {paper.title || 'Untitled Paper'}
                            </h2>
                            <StatusBadge status={paper.status} size="sm" />
                          </div>

                          {paper.authors && paper.authors.length > 0 && (
                            <p className="text-text-secondary text-sm mb-3">
                              {paper.authors.join(', ')}
                            </p>
                          )}

                          <div className="flex items-center gap-6 text-sm text-text-tertiary">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>{formatDate(paper.uploaded_at)}</span>
                            </div>

                            {paper.concept_count !== undefined && (
                              <span>{paper.concept_count} concepts</span>
                            )}

                            {paper.video_count !== undefined && (
                              <span>{paper.video_count} videos</span>
                            )}
                          </div>
                        </div>

                        <div className="text-text-tertiary">
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
