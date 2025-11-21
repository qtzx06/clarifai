'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { Navigation } from './components/navigation';
import { ShaderCanvas } from './components/shader-canvas';
import { uploadPaper } from './lib/api';

export default function Home() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger initial animation immediately
    setIsLoaded(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find((file) => file.type === 'application/pdf');

    if (!pdfFile) {
      setError('Please upload a PDF file');
      return;
    }

    await handleUpload(pdfFile);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    await handleUpload(file);
  }, []);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const paper = await uploadPaper(file);
      console.log('Upload successful, redirecting to:', `/papers/${paper.id}`);
      router.push(`/papers/${paper.id}`);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload paper. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-text-primary">
      {/* Fallback background in case WebGL fails */}
      <div className="fixed inset-0 bg-bg-primary -z-10" />

      {/* Shader Background with intro animation */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>
        <ShaderCanvas className="w-full h-full pointer-events-none" introDuration={2.5} />
      </div>

      {/* Overlay for better text readability */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0, delay: 1.5, ease: 'easeOut' }}
        className="fixed inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60 pointer-events-none"
        style={{ zIndex: 1 }}
      />

      <Navigation />

      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="mx-auto max-w-4xl space-y-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], delay: 2.0 }}
            className="text-center space-y-6"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-text-tertiary">ClarifAI Studio</p>
            <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-tight tracking-[-0.04em]">
              AI-powered research assistant for <span className="text-white">research intuition</span>.
            </h1>
            <p className="text-text-secondary text-lg">
              Upload a paper, let agents distill it into concepts, videos, and living notebooks.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.0, delay: 2.3, ease: [0.16, 1, 0.3, 1] }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group relative rounded-3xl border border-white/20 bg-black/40 backdrop-blur-3xl shadow-2xl p-14 transition-all duration-300 ${
              isDragging ? 'ring-2 ring-white/50 scale-[0.99] bg-black/50' : 'hover:ring-2 hover:ring-white/30 hover:bg-black/50 hover:shadow-[0_0_80px_rgba(255,255,255,0.1)]'
            } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-60" />
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="absolute inset-0 z-10 h-full w-full opacity-0 cursor-pointer"
            />

            <div className="relative z-20 flex flex-col items-center gap-6 text-center">
              <motion.div
                animate={isDragging ? { scale: 1.12 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="rounded-full border border-white/20 bg-black/30 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(255,255,255,0.15)]"
              >
                {isUploading ? (
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/15 border-t-white" />
                ) : (
                  <Upload className="h-16 w-16 text-white/70" />
                )}
              </motion.div>

              <div>
                <p className="text-2xl font-light tracking-tight">
                  {isUploading ? 'Uploading...' : 'Drop your PDF or click to browse'}
                </p>
                <p className="text-text-secondary mt-2">
                  {isUploading
                    ? 'Parsing, segmenting, and preparing your research artifact.'
                    : 'Drag-and-drop or tap to begin. We support comprehensive research PDFs.'}
                </p>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-full border border-accent-error/30 bg-accent-error/10 px-4 py-1 text-sm text-accent-error"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {isUploading && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeOut', repeat: Infinity }}
                className="absolute bottom-0 left-0 h-1 rounded-full bg-gradient-to-r from-white/0 via-white to-white/0"
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0, delay: 2.5, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-6 md:grid-cols-3"
          >
            {[
              {
                title: 'Concept distillation',
                description: 'LLM agents surface the core mechanisms and claims.',
              },
              {
                title: 'Video synthesis',
                description: 'Render animations with live logs.',
              },
              {
                title: 'Code sketches',
                description: 'Generate runnable Python code snippets aligned to each concept.',
              },
            ].map((feature, index) => ( 
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 2.6 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="card card-hover text-left"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-text-tertiary mb-3">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="text-xl font-light mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
