'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Send } from 'lucide-react';
import { Navigation } from '../../components/navigation';
import { StatusBadge } from '../../components/status-badge';
import { PDFViewer } from '../../components/pdf-viewer';
import {
  getPaper,
  analyzePaper,
  getConcepts,
  generateAdditionalConcept,
  generateVideo,
  askQuestion,
  type Paper,
  type Concept,
} from '../../lib/api';

export default function PaperDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const rawPaperId = params?.id;
  const paperId = Array.isArray(rawPaperId) ? rawPaperId[0] : rawPaperId;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) return;
    loadPaper();
  }, [paperId]);

  useEffect(() => {
    if (paper?.status === 'analyzed') {
      loadConcepts();
    }
  }, [paper?.status]);

  const loadPaper = async () => {
    if (!paperId) return;
    try {
      const paperData = await getPaper(paperId);
      setPaper(paperData);
    } catch (err) {
      setError('Failed to load paper');
    }
  };

  const loadConcepts = async () => {
    if (!paperId) return;
    try {
      const conceptsData = await getConcepts(paperId);
      setConcepts(conceptsData);
    } catch (err) {
      console.error('Failed to load concepts:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!paperId) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      await analyzePaper(paperId);
      setPaper((prev) => prev && { ...prev, status: 'analyzing' });

      // Poll for analysis completion
      const pollInterval = setInterval(async () => {
        const updatedPaper = await getPaper(paperId);
        setPaper(updatedPaper);

        if (updatedPaper.status === 'analyzed') {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          loadConcepts();
        } else if (updatedPaper.status === 'error') {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          setError('Analysis failed');
        }
      }, 3000);
    } catch (err) {
      setIsAnalyzing(false);
      setError('Failed to start analysis');
    }
  };

  const handleGenerateConcept = async () => {
    if (!paperId) return;
    setIsGeneratingConcept(true);

    try {
      const newConcept = await generateAdditionalConcept(paperId);
      setConcepts((prev) => [...prev, newConcept]);
    } catch (err) {
      setError('Failed to generate concept');
    } finally {
      setIsGeneratingConcept(false);
    }
  };

  const handleGenerateVideo = async (conceptId: string) => {
    if (!paperId) return;
    try {
      await generateVideo(paperId, conceptId);
      // Update concept status
      setConcepts((prev) =>
        prev.map((c) =>
          c.id === conceptId ? { ...c, video_status: 'generating' } : c
        )
      );
    } catch (err) {
      setError('Failed to start video generation');
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId) return;
    if (!question.trim()) return;

    setIsAsking(true);
    setAnswer('');

    try {
      const response = await askQuestion(paperId, question);
      setAnswer(response.answer);
    } catch (err) {
      setError('Failed to get answer');
    } finally {
      setIsAsking(false);
    }
  };

  if (!paperId) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="pt-24 px-6">
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="pt-24 px-6">
          <div className="max-w-7xl mx-auto text-center py-16">
            <p className="text-accent-error">{error}</p>
            <button onClick={() => router.push('/papers')} className="btn-secondary mt-4">
              Back to Papers
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="pt-24 px-6">
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navigation />

      <main className="pt-20 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={() => router.push('/papers')}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {paper.title || paper.filename}
                </h1>
                {paper.authors && paper.authors.length > 0 && (
                  <p className="text-text-secondary">{paper.authors.join(', ')}</p>
                )}
              </div>

              {paper.status === 'uploaded' && (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="btn-primary"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Paper'}
                </button>
              )}
            </div>
          </motion.div>

          {/* 3-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PDF Viewer - Left Column (40%) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-5 xl:col-span-5"
            >
              <div className="card h-[calc(100vh-200px)] overflow-hidden">
                <PDFViewer paperId={paperId} filename={paper.filename} />
              </div>
            </motion.div>

            {/* Concepts List - Center Column (35%) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-4 xl:col-span-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Concepts</h2>
                  <StatusBadge status={paper.status} size="sm" />
                </div>

                {paper.status === 'analyzing' && (
                  <div className="card text-center py-8">
                    <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-text-secondary">Analyzing paper...</p>
                  </div>
                )}

                {paper.status === 'analyzed' && concepts.length === 0 && (
                  <div className="card text-center py-8">
                    <p className="text-text-secondary">No concepts found</p>
                  </div>
                )}

                <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {concepts.map((concept, index) => (
                    <motion.div
                      key={concept.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="card card-hover cursor-pointer"
                      onClick={() => router.push(`/papers/${paperId}/concepts/${concept.id}`)}
                    >
                      <div className="mb-2">
                        <h3 className="font-semibold mb-1">{concept.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-text-tertiary">
                          <span className="px-2 py-0.5 bg-bg-hover rounded">{concept.type}</span>
                          <span>• {concept.importance_score}/100</span>
                        </div>
                      </div>

                      <p className="text-sm text-text-secondary line-clamp-2 mb-3">
                        {concept.description}
                      </p>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateVideo(concept.id);
                        }}
                        disabled={concept.video_status === 'generating'}
                        className={`w-full text-sm py-2 px-3 rounded-md transition-colors ${
                          concept.video_status === 'ready'
                            ? 'bg-accent-success/10 text-accent-success border border-accent-success/30'
                            : 'bg-bg-hover text-text-secondary border border-accent-border hover:border-text-primary'
                        }`}
                      >
                        {concept.video_status === 'ready'
                          ? '✓ View Video'
                          : concept.video_status === 'generating'
                          ? 'Generating...'
                          : 'Generate Video'}
                      </button>
                    </motion.div>
                  ))}
                </div>

                {paper.status === 'analyzed' && (
                  <button
                    onClick={handleGenerateConcept}
                    disabled={isGeneratingConcept}
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {isGeneratingConcept ? 'Generating...' : 'Generate Concept'}
                  </button>
                )}
              </div>
            </motion.div>

            {/* Sidebar - Right Column (25%) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="lg:col-span-3 xl:col-span-3"
            >
              <div className="space-y-6">
                {/* Paper Info */}
                {paper.abstract && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Abstract</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                )}

                {/* Q&A Section */}
                <div className="card">
                  <h3 className="font-semibold mb-3">Ask Questions</h3>

                  <form onSubmit={handleAskQuestion} className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask about this paper..."
                        disabled={isAsking}
                        className="flex-1 bg-bg-secondary border border-accent-border rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-text-primary transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={isAsking || !question.trim()}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>

                  {isAsking && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <div className="w-4 h-4 border-2 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  )}

                  {answer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-bg-hover rounded-md"
                    >
                      <p className="text-sm text-text-secondary leading-relaxed">{answer}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
