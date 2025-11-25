'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Send, X } from 'lucide-react';
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
  connectToLogs,
  type Paper,
  type Concept,
  type ChatMessage,
  type VideoCaption,
} from '../../lib/api';

// Helper function to fix abstract text that has lost spaces
function fixAbstractSpacing(text: string): string {
  // Add space before capital letters that follow lowercase letters
  let fixed = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Normalize multiple spaces to single space
  fixed = fixed.replace(/\s+/g, ' ').trim();
  return fixed;
}

// Render scene guide (captions) for a video
function renderSceneGuide(video: VideoModalData | null, mode: 'inline' | 'modal') {
  if (!video || !video.captions || video.captions.length === 0) {
    return (
      <div className="text-sm text-text-tertiary">
        No captions available for this video.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {video.captions.map((caption, index) => (
        <div
          key={index}
          className={`rounded-lg border ${
            mode === 'modal'
              ? 'border-white/10 bg-white/5 p-3'
              : 'border-white/5 bg-white/[0.02] p-2.5'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xs font-semibold text-text-secondary min-w-[2rem]">
              {caption.clip ?? index + 1}
            </span>
            <p className="text-sm text-text-primary leading-relaxed flex-1">
              {caption.text || 'No description available'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:8000');

type VideoModalData = {
  id: string;
  url: string;
  name: string;
  captions?: VideoCaption[];
};

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string>('Starting analysis...');
  const [videoLogs, setVideoLogs] = useState<string[]>([]);
  const [videoProgress, setVideoProgress] = useState<{
    current_scene: number;
    total_scenes: number;
    stage: string;
    details: string;
    progress_percent: number;
  } | null>(null);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [generatingConceptId, setGeneratingConceptId] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<VideoModalData | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoModalData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const videoPanelRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!paperId) return;
    loadPaper();
  }, [paperId]);

  useEffect(() => {
    if (paper?.status === 'analyzed') {
      loadConcepts();
    } else if (paper?.status === 'analyzing') {
      // If paper is already analyzing when page loads, start polling
      setIsAnalyzing(true);
    }
  }, [paper?.status]);

  // Auto-scroll to bottom only when new messages are actually added
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Only auto-scroll if:
    // 1. A new message was actually added (length increased)
    // 2. User is likely at the bottom (check if scroll is near bottom)
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (messages.length > prevMessagesLengthRef.current && messagesContainer) {
      const isNearBottom = 
        messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
      
      // Only scroll if user is near bottom (within 100px) or this is the first message
      if (isNearBottom || prevMessagesLengthRef.current === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length]); // Only depend on length, not the full array

  // Don't auto-scroll logs during generation - let user control their view
  // Removed auto-scroll to prevent forced scrolling beyond view

  // Fake progress bar that smoothly increases to 99% over ~90 seconds
  useEffect(() => {
    if (!generatingConceptId) {
      setFakeProgress(0);
      return;
    }

    const startTime = Date.now();
    const duration = 90000; // 90 seconds to reach 99%
    const maxProgress = 99;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * maxProgress, maxProgress);

      // Ease out function for smooth deceleration
      const easedProgress = maxProgress * (1 - Math.pow(1 - progress / maxProgress, 3));
      setFakeProgress(Math.floor(easedProgress));

      if (progress >= maxProgress) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [generatingConceptId]);

  // Poll for status updates when analyzing
  useEffect(() => {
    if (!paperId || paper?.status !== 'analyzing') return;

    const messages = [
      'Parsing PDF content...',
      'Extracting text and structure...',
      'Analyzing with AI...',
      'Identifying key concepts...',
      'Extracting metadata...',
      'Almost done...',
    ];

    let messageIndex = 0;
    setAnalysisMessage(messages[0]);

    // Rotate messages every 3 seconds
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setAnalysisMessage(messages[messageIndex]);
    }, 3000);

    // Poll status every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const updatedPaper = await getPaper(paperId);
        setPaper(updatedPaper);

        if (updatedPaper.status === 'analyzed') {
          clearInterval(pollInterval);
          clearInterval(messageInterval);
          setIsAnalyzing(false);
          setAnalysisMessage('Analysis complete!');
          setTimeout(() => setAnalysisMessage(''), 2000);
          loadConcepts();
        } else if (updatedPaper.status === 'error') {
          clearInterval(pollInterval);
          clearInterval(messageInterval);
          setIsAnalyzing(false);
          setError('Analysis failed');
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(messageInterval);
    };
  }, [paperId, paper?.status]);

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
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/papers/${paperId}/generate-additional-concept`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to generate concept');
      }

      const data = await response.json();
      
      if (data.success && data.new_concept) {
        setConcepts((prev) => [...prev, data.new_concept]);
      } else {
        setError(data.message || 'Generated concept was too generic. Please try again.');
      }
    } catch (err) {
      setError('Failed to generate concept. Please try again.');
    } finally {
      setIsGeneratingConcept(false);
    }
  };

  const resolveVideoUrl = (path: string) =>
    path.startsWith('http') ? path : `${API_BASE}${path}`;

  const createVideoData = (concept: Concept): VideoModalData => ({
    id: concept.id,
    url: resolveVideoUrl(concept.video_url || ''),
    name: concept.name,
    captions: concept.video_captions,
  });

  const handleGenerateVideo = async (conceptId: string) => {
    if (!paperId) return;
    try {
      setSelectedVideo(null);
      if (currentVideo?.id === conceptId) {
        setCurrentVideo(null);
      }
      setGeneratingConceptId(conceptId);
      setVideoLogs([]);
      setVideoProgress(null);
      setFakeProgress(0);
      await generateVideo(paperId, conceptId);
      // Update concept status
      setConcepts((prev) =>
        prev.map((c) =>
          c.id === conceptId ? { ...c, video_status: 'generating' } : c
        )
      );
    } catch (err) {
      setError('Failed to start video generation');
      setGeneratingConceptId(null);
    }
  };

  const handleConceptVideoAction = (concept: Concept) => {
    if (!paperId) return;

    if (concept.video_status === 'ready' && concept.video_url) {
      const videoData = createVideoData(concept);
      setCurrentVideo(videoData);
      videoPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    handleGenerateVideo(concept.id);
  };

  // Track previous concept states to detect when video becomes ready
  const prevConceptsRef = useRef<Concept[]>([]);
  
  // Automatically load the latest ready video and scroll to it when generation completes
  useEffect(() => {
    const readyConcept = concepts.find(
      (concept) => concept.video_status === 'ready' && concept.video_url
    );

    if (!readyConcept) {
      if (!generatingConceptId) {
        setCurrentVideo(null);
      }
      prevConceptsRef.current = concepts;
      return;
    }

    const videoData = createVideoData(readyConcept);
    
    // Check if this concept just transitioned from generating to ready
    const prevConcept = prevConceptsRef.current.find(c => c.id === readyConcept.id);
    const justBecameReady = prevConcept?.video_status === 'generating' && readyConcept.video_status === 'ready';
    const wasGenerating = generatingConceptId === readyConcept.id;
    
    setCurrentVideo((prev) => {
      // If this is a new video or the URL changed, update it
      if (!prev || prev.id !== videoData.id || prev.url !== videoData.url) {
        // If we were just generating this video or it just became ready, scroll to it
        if (justBecameReady || wasGenerating) {
          // Small delay to ensure video element is rendered
          setTimeout(() => {
            videoPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 500);
        }
        return videoData;
      }
      return prev;
    });
    
    // Update previous concepts for next comparison
    prevConceptsRef.current = concepts;
  }, [concepts, generatingConceptId]);

  // Connect to WebSocket when video generation starts
  useEffect(() => {
    if (!paperId || !generatingConceptId) {
      // Clean up if no longer generating
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        console.log('Cleaning up WebSocket - no longer generating');
        wsRef.current.close();
        wsRef.current = null;
      }
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
      return;
    }

    // Don't create a new connection if one already exists and is open
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected, skipping');
        return;
      } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
        console.log('WebSocket already connecting, skipping');
        return;
      } else {
        // Connection is closed, clean it up
        wsRef.current = null;
      }
    }

    console.log('Creating new WebSocket connection for video logs');
    const ws = connectToLogs(paperId);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected for video logs');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log' && data.message) {
          setVideoLogs((prev) => [...prev, data.message]);
        } else if (data.type === 'progress' && data.data) {
          console.log('Progress update:', data.data);
          setVideoProgress(data.data);
        } else if (data.type === 'connected') {
          console.log('WebSocket connection confirmed:', data.message);
        } else if (data.type === 'keepalive' || data.type === 'pong') {
          // Ignore keepalive messages
        }
      } catch (err) {
        // If not JSON, treat as plain text
        setVideoLogs((prev) => [...prev, event.data]);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Lost connection to video generation logs');
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      wsRef.current = null;
      if (event.code !== 1000) { // 1000 is normal closure
        setError('Connection to video logs closed unexpectedly');
      }
    };
    
    // Poll for video status to detect completion
    // Wait a bit before starting to poll to give the backend time to set status
    statusTimeoutRef.current = setTimeout(() => {
      statusIntervalRef.current = setInterval(async () => {
        try {
          const updatedConcepts = await getConcepts(paperId);
          const updatedConcept = updatedConcepts.find((c) => c.id === generatingConceptId);
          console.log('Polling video status:', updatedConcept?.video_status, 'for concept:', generatingConceptId);
          
          // Only close WebSocket if status is definitively NOT generating
          // If status is undefined or 'not_generated', keep the connection open (might be a timing issue)
          if (updatedConcept && updatedConcept.video_status && updatedConcept.video_status !== 'generating' && updatedConcept.video_status !== 'not_generated') {
            console.log('Video generation completed, status:', updatedConcept.video_status);
            if (statusIntervalRef.current) {
              clearInterval(statusIntervalRef.current);
              statusIntervalRef.current = null;
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.close(1000, 'Video generation completed');
            }
            setGeneratingConceptId(null);
            setConcepts(updatedConcepts);
          } else if (updatedConcept && (!updatedConcept.video_status || updatedConcept.video_status === 'not_generated')) {
            // Status not set yet or reset - log but don't close (might be a timing issue)
            console.log('Video status not set yet or reset, keeping WebSocket open. Status:', updatedConcept.video_status);
          }
        } catch (err) {
          console.error('Failed to poll video status:', err);
        }
      }, 3000); // Poll every 3 seconds
    }, 5000); // Start polling after 5 seconds (increased to give backend more time)
    
    // Cleanup
    return () => {
      console.log('Cleaning up WebSocket connection');
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = null;
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [paperId, generatingConceptId]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId) return;
    if (!question.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: question.trim(),
    };

    // Add user message to chat
    setMessages((prev) => [...prev, userMessage]);
    const currentQuestion = question.trim();
    setQuestion('');
    setIsAsking(true);

    try {
      const response = await askQuestion(paperId, currentQuestion, messages);
      
      // Add assistant response to chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to get answer');
      // Remove the user message if request failed
      setMessages((prev) => prev.slice(0, -1));
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
      <div className="relative min-h-screen overflow-hidden bg-bg-primary text-text-primary">
        <Navigation />
        <main className="pt-32 px-6">
          <div className="mx-auto max-w-4xl text-center py-16 space-y-4">
            <p className="text-accent-error">{error}</p>
            <button onClick={() => router.push('/papers')} className="btn-secondary">
              Back to Papers
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-bg-primary text-text-primary">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 right-0 h-[24rem] w-[24rem] rounded-full bg-white/8 blur-[140px] opacity-50" />
        </div>
        <Navigation />
        <main className="relative z-10 pt-32 px-6">
          <div className="mx-auto flex max-w-4xl items-center justify-center py-20">
            <div className="glass-panel px-10 py-12 text-center">
              <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-white" />
              <p className="text-text-secondary">Loading paper insights…</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-primary text-text-primary">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-0 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-[150px] opacity-45 animate-float" />
        <div
          className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-white/6 blur-[200px] opacity-35 animate-float"
          style={{ animationDelay: '1.4s' }}
        />
      </div>
      <Navigation />

      <main className="relative z-10 pt-28 pb-20 px-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={() => router.push('/papers')}
              className="btn-secondary mb-4 flex items-center gap-2 text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Library</span>
            </button>

            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="mb-2 text-[clamp(2rem,3vw,3.5rem)] font-light leading-tight tracking-[-0.03em]">
                  {paper.title || paper.filename}
                </h1>
                {paper.authors && paper.authors.length > 0 && (
                  <p className="text-text-secondary">{paper.authors.join(', ')}</p>
                )}
              </div>

              {(paper.status === 'uploaded' || paper.status === 'analyzing') && (
                <div className="flex items-center gap-2 text-text-secondary text-sm">
                  {paper.status === 'analyzing' && (
                    <>
                      <div className="w-4 h-4 border-2 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  )}
              {paper.status === 'uploaded' && (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="btn-primary"
                >
                      {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PDF Viewer - Left Side (Wide) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="card h-full overflow-hidden">
                <PDFViewer paperId={paperId} filename={paper.filename} />
              </div>
            </motion.div>

            {/* Right Side - Stacked Grid */}
            <div className="lg:col-span-1 grid grid-rows-2 gap-6">
              {/* Concepts List - Top Right */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
                className="overflow-hidden"
            >
                <div className="card h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Concepts</h2>
                  <StatusBadge status={paper.status} size="sm" />
                </div>

                {paper.status === 'analyzing' && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                    <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-text-secondary font-medium mb-2">{analysisMessage}</p>
                        <p className="text-text-tertiary text-sm">This may take a minute...</p>
                      </div>
                  </div>
                )}

                {paper.status === 'analyzed' && concepts.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                    <p className="text-text-secondary">No concepts found</p>
                  </div>
                )}

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
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
                          <h3 className="font-semibold mb-1 text-sm">{concept.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-text-tertiary">
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                              {concept.type}
                            </span>
                            <span>• {Math.round(concept.importance_score * 100)}/100</span>
                        </div>
                      </div>

                        <p className="text-xs text-text-secondary line-clamp-2 mb-2">
                        {concept.description}
                      </p>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                            handleConceptVideoAction(concept);
                        }}
                        disabled={concept.video_status === 'generating'}
                          className={`w-full text-xs py-1.5 px-2 rounded-md transition-colors ${
                          concept.video_status === 'ready'
                            ? 'bg-accent-success/10 text-accent-success border border-accent-success/30'
                              : 'bg-white/5 text-text-secondary border border-white/15 hover:border-white/30'
                        }`}
                      >
                        {concept.video_status === 'ready'
                            ? '✓ Watch Video'
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
                      className="w-full btn-secondary flex items-center justify-center gap-2 text-sm py-2 mt-4"
                  >
                    <Plus className="w-4 h-4" />
                    {isGeneratingConcept ? 'Generating...' : 'Generate Concept'}
                  </button>
                )}

                  {/* Video Generation Progress */}
                  {generatingConceptId && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-text-secondary">
                          Generating Video
                        </h3>
                        <span className="text-xs text-text-tertiary">
                          {fakeProgress}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/60 to-white/80 transition-all duration-300 ease-out"
                          style={{ width: `${fakeProgress}%` }}
                        />
                      </div>

                      {/* Status Text */}
                      {videoProgress && (
                        <div className="text-xs text-text-secondary">
                          <div className="flex items-center justify-between mb-1">
                            <span>
                              {videoProgress.stage === 'splitting' && 'Analyzing concept...'}
                              {videoProgress.stage === 'generating_code' && 'Generating animation code...'}
                              {videoProgress.stage === 'rendering' && 'Rendering video...'}
                              {videoProgress.stage === 'stitching' && 'Finalizing...'}
                            </span>
                            <span className="text-text-tertiary">
                              Scene {videoProgress.current_scene}/{videoProgress.total_scenes}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video Generation Logs */}
                  {generatingConceptId && videoLogs.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <h3 className="text-sm font-semibold mb-2 text-text-secondary">
                        Detailed Logs
                      </h3>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 max-h-40 overflow-y-auto text-xs font-mono backdrop-blur-xl">
                        {videoLogs.map((log, index) => (
                          <div key={index} className="text-text-tertiary mb-1">
                            {log}
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                )}
              </div>
            </motion.div>

              {/* Chat Section - Bottom Right */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
                className="overflow-hidden"
              >
                <div className="card flex flex-col h-full">
                  <h3 className="font-semibold mb-3">Chat</h3>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-2">
                    {messages.length === 0 && (
                      <div className="text-center text-text-tertiary text-xs py-6">
                        <p>Start a conversation</p>
                        <p className="text-xs mt-1">Ask questions about the paper</p>
                      </div>
                    )}
                    {messages.map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                            message.role === 'user'
                              ? 'bg-text-primary text-bg-primary'
              : 'border border-white/10 bg-white/10 text-text-secondary backdrop-blur-xl'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      </motion.div>
                    ))}
                    {isAsking && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
        <div className="rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs backdrop-blur-xl">
                          <div className="flex items-center gap-2 text-text-secondary">
                            <div className="w-2.5 h-2.5 border-2 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form onSubmit={handleAskQuestion} className="mt-auto">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Ask about this paper..."
                        disabled={isAsking}
                        className="flex-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-white/25 transition"
                      />
                      <button
                        type="submit"
                        disabled={isAsking || !question.trim()}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
                    </div>

        {/* Video Preview Section */}
                    <motion.div
          ref={videoPanelRef}
          initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          id="video-preview"
          className="mt-6"
        >
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Video Preview</p>
                <h2 className="text-lg font-semibold text-text-primary">
                  {currentVideo ? currentVideo.name : 'No rendered video yet'}
                </h2>
                <p className="text-xs text-text-tertiary">
                  Select any concept with a completed video to load it here.
                </p>
              </div>
              {currentVideo && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedVideo(currentVideo)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Open Full Player
                  </button>
                </div>
              )}
            </div>

            {currentVideo ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="rounded-xl border border-white/10 bg-black overflow-hidden">
                  <video
                    key={`${currentVideo.id}-${currentVideo.url}`}
                    controls
                    playsInline
                    className="w-full h-full max-h-[60vh] bg-black"
                    src={currentVideo.url}
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col backdrop-blur-xl">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-text-primary">Scene Guide</p>
                    <p className="text-xs text-text-tertiary">
                      Captions are generated directly from the agent’s outline.
                    </p>
                  </div>
                  <div className="overflow-y-auto pr-1">
                    {renderSceneGuide(currentVideo, 'inline')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center min-h-[220px] text-sm text-text-secondary">
                {generatingConceptId ? (
                  <>
                    <div className="w-8 h-8 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin mb-3" />
                    <p>Generating video…</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Logs will appear once the agent starts streaming output.
                    </p>
                  </>
                ) : (
                  <>
                    <p>No video has been rendered for this paper yet.</p>
                    <p className="text-xs text-text-tertiary mt-1">
                      Use the “Generate Video” button on any concept to create one.
                    </p>
                  </>
                )}
              </div>
            )}
              </div>
            </motion.div>
      </main>
      {selectedVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6">
          <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#050505] p-6 shadow-2xl">
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close video player"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 flex flex-col gap-6 pt-4">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Now Playing</p>
                <h3 className="text-lg font-semibold text-text-primary">{selectedVideo.name}</h3>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] flex-1 min-h-0">
                <div className="flex flex-col rounded-xl border border-white/10 bg-black overflow-hidden">
                  <video
                    key={selectedVideo.url}
                    controls
                    playsInline
                    className="w-full h-full flex-1 min-h-0 bg-black object-contain"
                    src={selectedVideo.url}
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col min-h-0 backdrop-blur-xl">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-text-primary">Scene Guide</p>
                    <p className="text-xs text-text-tertiary">
                      Follow along with the narration for each generated clip.
                    </p>
                  </div>
                  <div className="overflow-y-auto pr-2 flex-1 min-h-0">
                    {renderSceneGuide(selectedVideo, 'modal')}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-start justify-between sm:flex-row sm:items-center">
                <p className="text-xs text-text-tertiary">
                  Captions are generated directly from the agent’s scene descriptions.
                </p>
                <a
                  href={selectedVideo.url}
                  download
                  className="text-sm text-text-secondary hover:text-text-primary underline-offset-4 hover:underline"
                >
                  Download video
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
