'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Play, Code2, FileText, Terminal } from 'lucide-react';
import { Navigation } from '../../../../components/navigation';
import { StatusBadge } from '../../../../components/status-badge';
import * as Tabs from '@radix-ui/react-tabs';
import {
  getConcepts,
  getVideoStatus,
  getCodeImplementation,
  connectToLogs,
  type Concept,
} from '../../../../lib/api';

export default function ConceptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const conceptId = params.conceptId as string;

  const [concept, setConcept] = useState<Concept | null>(null);
  const [activeTab, setActiveTab] = useState('explanation');
  const [code, setCode] = useState<string | null>(null);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConcept();
  }, [paperId, conceptId]);

  useEffect(() => {
    if (concept?.video_status === 'generating') {
      // Connect to WebSocket for live logs
      const ws = connectToLogs(paperId);

      ws.onmessage = (event) => {
        const message = event.data;
        setLogs((prev) => [...prev, message]);
      };

      ws.onerror = () => {
        setError('Lost connection to logs');
      };

      return () => {
        ws.close();
      };
    }
  }, [concept?.video_status, paperId]);

  const loadConcept = async () => {
    try {
      const concepts = await getConcepts(paperId);
      const foundConcept = concepts.find((c) => c.id === conceptId);

      if (!foundConcept) {
        setError('Concept not found');
        return;
      }

      setConcept(foundConcept);

      // Poll for video status if generating
      if (foundConcept.video_status === 'generating') {
        pollVideoStatus();
      }
    } catch (err) {
      setError('Failed to load concept');
    }
  };

  const pollVideoStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const status = await getVideoStatus(paperId, conceptId);

        if (status.status === 'completed') {
          clearInterval(interval);
          setConcept((prev) => prev && {
            ...prev,
            video_status: 'ready',
            video_url: status.video_url,
          });
        } else if (status.status === 'error') {
          clearInterval(interval);
          setConcept((prev) => prev && { ...prev, video_status: 'error' });
        }
      } catch (err) {
        console.error('Failed to poll video status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  };

  const handleLoadCode = async () => {
    if (!concept) return;

    setIsLoadingCode(true);

    try {
      const response = await getCodeImplementation(paperId, concept.name);
      setCode(response.code);
      setActiveTab('code');
    } catch (err) {
      setError('Failed to generate code');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
    }
  };

  const handleDownloadVideo = () => {
    if (concept?.video_url) {
      window.open(concept.video_url, '_blank');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="pt-24 px-6">
          <div className="max-w-7xl mx-auto text-center py-16">
            <p className="text-accent-error mb-4">{error}</p>
            <button onClick={() => router.push(`/papers/${paperId}`)} className="btn-secondary">
              Back to Paper
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!concept) {
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={() => router.push(`/papers/${paperId}`)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Paper</span>
            </button>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{concept.name}</h1>
                <div className="flex items-center gap-3 text-sm text-text-tertiary">
                  <span className="px-2 py-1 bg-bg-tertiary border border-accent-border rounded">
                    {concept.type}
                  </span>
                  <span>Importance: {concept.importance_score}/100</span>
                </div>
              </div>

              <StatusBadge status={concept.video_status || 'not_generated'} />
            </div>
          </motion.div>

          {/* Video Player */}
          {concept.video_status === 'ready' && concept.video_url && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <div className="card p-0 overflow-hidden">
                <video
                  controls
                  className="w-full aspect-video bg-bg-primary"
                  src={concept.video_url}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>
          )}

          {/* Generating State */}
          {concept.video_status === 'generating' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <div className="card aspect-video flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-text-secondary">Generating video...</p>
                  <p className="text-text-tertiary text-sm mt-2">This may take a few minutes</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Not Generated State */}
          {concept.video_status === 'not_generated' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <div className="card aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                  <p className="text-text-secondary mb-4">Video not generated yet</p>
                  <button
                    onClick={() => router.push(`/papers/${paperId}`)}
                    className="btn-primary"
                  >
                    Generate Video
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              <Tabs.List className="flex gap-4 border-b border-accent-border mb-6">
                <Tabs.Trigger
                  value="explanation"
                  className={`flex items-center gap-2 pb-3 px-2 transition-colors border-b-2 ${
                    activeTab === 'explanation'
                      ? 'border-text-primary text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Explanation</span>
                </Tabs.Trigger>

                <Tabs.Trigger
                  value="code"
                  className={`flex items-center gap-2 pb-3 px-2 transition-colors border-b-2 ${
                    activeTab === 'code'
                      ? 'border-text-primary text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                  <span>Code</span>
                </Tabs.Trigger>

                {concept.video_status === 'generating' && (
                  <Tabs.Trigger
                    value="logs"
                    className={`flex items-center gap-2 pb-3 px-2 transition-colors border-b-2 ${
                      activeTab === 'logs'
                        ? 'border-text-primary text-text-primary'
                        : 'border-transparent text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span>Logs</span>
                  </Tabs.Trigger>
                )}
              </Tabs.List>

              {/* Explanation Tab */}
              <Tabs.Content value="explanation">
                <div className="card">
                  <p className="text-text-secondary leading-relaxed">{concept.description}</p>
                </div>
              </Tabs.Content>

              {/* Code Tab */}
              <Tabs.Content value="code">
                <div className="card">
                  {!code ? (
                    <div className="text-center py-8">
                      <Code2 className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                      <p className="text-text-secondary mb-4">No code generated yet</p>
                      <button
                        onClick={handleLoadCode}
                        disabled={isLoadingCode}
                        className="btn-primary"
                      >
                        {isLoadingCode ? 'Generating...' : 'Generate Code'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">Python Implementation</h3>
                        <button onClick={handleCopyCode} className="btn-secondary text-sm">
                          Copy Code
                        </button>
                      </div>
                      <pre className="bg-bg-primary border border-accent-border rounded-lg p-4 overflow-x-auto">
                        <code className="text-sm text-text-secondary">{code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </Tabs.Content>

              {/* Logs Tab */}
              {concept.video_status === 'generating' && (
                <Tabs.Content value="logs">
                  <div className="card">
                    <h3 className="font-semibold mb-4">Generation Logs</h3>
                    <div className="bg-bg-primary border border-accent-border rounded-lg p-4 max-h-[500px] overflow-y-auto">
                      {logs.length === 0 ? (
                        <p className="text-text-tertiary text-sm">Waiting for logs...</p>
                      ) : (
                        <div className="space-y-1">
                          {logs.map((log, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-sm text-text-secondary font-mono"
                            >
                              {log}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>
              )}
            </Tabs.Root>
          </motion.div>

          {/* Actions */}
          {concept.video_status === 'ready' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex gap-4 mt-6"
            >
              <button onClick={handleDownloadVideo} className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>Download Video</span>
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
