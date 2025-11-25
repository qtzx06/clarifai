'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Clock, Search, Trash2 } from 'lucide-react';
import { Navigation } from '../components/navigation';
import { StatusBadge } from '../components/status-badge';
import { deletePaper, listPapers } from '../lib/api';
import { useAuth } from '../providers/auth-provider';

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
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadPapers = async () => {
      try {
        setIsLoading(true);
        const papersData = await listPapers();
        
        // Map backend response to frontend format
        // Backend returns: analysis_status ("pending", "processing", "completed", "failed")
        // Frontend expects: status ("uploaded", "analyzing", "analyzed", "error")
        const statusMap: Record<string, 'uploaded' | 'analyzing' | 'analyzed' | 'error'> = {
          'pending': 'uploaded',
          'processing': 'analyzing',
          'completed': 'analyzed',
          'failed': 'error',
        };
        
        const mappedPapers: PaperItem[] = papersData.map((paper: any) => ({
          id: paper.id,
          title: paper.title || 'Untitled Paper',
          authors: paper.authors || [],
          uploaded_at: paper.upload_time ? new Date(paper.upload_time).toISOString() : new Date().toISOString(),
          status: statusMap[paper.analysis_status] || 'uploaded',
          concept_count: paper.concepts_count,
          video_count: paper.has_video ? 1 : 0,
        }));
        
        setPapers(mappedPapers);
        setError(null);
      } catch (err) {
        console.error('Failed to load papers:', err);
        setError('Failed to load papers. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadPapers();
    }
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

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

  const handleDeleteClick = (e: React.MouseEvent, paper: PaperItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm({ id: paper.id, title: paper.title });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await deletePaper(deleteConfirm.id);
      setPapers(papers.filter(p => p.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete paper:', err);
      setError('Failed to delete paper. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-primary text-text-primary">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-0 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-[140px] opacity-45 animate-float" />
        <div
          className="absolute -bottom-32 right-0 h-[32rem] w-[32rem] rounded-full bg-white/5 blur-[180px] opacity-40 animate-float"
          style={{ animationDelay: '1.2s' }}
        />
      </div>

      <Navigation />

      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="mx-auto max-w-6xl space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-text-tertiary">Library</p>
            <h1 className="text-[clamp(2rem,4vw,3.5rem)] font-light leading-tight tracking-[-0.03em]">
              Archive of your analyzed papers.
            </h1>
            <p className="text-text-secondary">
              Search, revisit, and relaunch concept extraction or video generation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by title or author"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/5 pl-14 pr-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-white/20 backdrop-blur-xl transition"
            />
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-accent-error/40 bg-accent-error/10 px-4 py-3 text-accent-error backdrop-blur-xl"
            >
              {error}
            </motion.div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-white" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="glass-panel text-center py-12"
            >
              <FileText className="mx-auto mb-4 h-16 w-16 text-text-tertiary" />
              <h3 className="text-2xl font-light mb-2">Nothing here yet</h3>
              <p className="text-text-secondary mb-6">
                {searchQuery ? 'No papers match your query.' : 'Upload a paper to start your collection.'}
              </p>
              {!searchQuery && (
                <Link href="/" className="btn-primary inline-flex">
                  Upload Paper
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="space-y-4">
              {filteredPapers.map((paper, index) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="card card-hover p-6 relative group">
                    <Link href={`/papers/${paper.id}`} className="block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h2 className="text-2xl font-light tracking-tight">
                              {paper.title || 'Untitled Paper'}
                            </h2>
                            <StatusBadge status={paper.status} size="sm" />
                          </div>
                          {paper.authors && paper.authors.length > 0 && (
                            <p className="text-text-secondary text-sm mb-4">
                              {paper.authors.join(', ')}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-6 text-sm text-text-tertiary">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
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
                        <div className="flex flex-col items-center gap-3 shrink-0">
                          <div className="text-text-tertiary">
                            <svg
                              className="h-6 w-6"
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
                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDeleteClick(e, paper)}
                            className="p-2 rounded-lg border border-white/10 bg-black/40 text-text-tertiary hover:text-accent-error hover:border-accent-error/40 hover:bg-accent-error/10 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete paper"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleDeleteCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel max-w-md w-full p-8 space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-full p-3 bg-accent-error/10 border border-accent-error/20">
                  <Trash2 className="h-6 w-6 text-accent-error" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-light mb-2">Delete Paper?</h3>
                  <p className="text-text-secondary text-sm">
                    Are you sure you want to delete <span className="text-white font-medium">"{deleteConfirm.title}"</span>? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-text-primary hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl border border-accent-error/40 bg-accent-error/20 text-accent-error hover:bg-accent-error/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-error/30 border-t-accent-error" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
