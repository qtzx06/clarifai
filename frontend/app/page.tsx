'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Upload, FileText } from 'lucide-react';
import { Navigation } from './components/navigation';
import { uploadPaper } from './lib/api';

export default function Home() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(`/papers/${paper.id}`);
    } catch (err) {
      setError('Failed to upload paper. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navigation />

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl font-bold mb-4 tracking-tight">
              Upload Research Paper
            </h1>
            <p className="text-text-secondary text-lg">
              Analyze • Visualize • Understand
            </p>
          </motion.div>

          {/* Upload Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-16 transition-all duration-200 ${
              isDragging
                ? 'border-text-primary bg-bg-hover scale-[0.98]'
                : 'border-accent-border bg-bg-secondary'
            } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:border-text-tertiary'}`}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-6">
              <motion.div
                animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isUploading ? (
                  <div className="w-16 h-16 border-4 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
                ) : (
                  <Upload className="w-16 h-16 text-text-tertiary" />
                )}
              </motion.div>

              <div className="text-center">
                <p className="text-xl font-medium mb-2">
                  {isUploading ? 'Uploading...' : 'Drop PDF or Click'}
                </p>
                <p className="text-text-secondary text-sm">
                  {isUploading
                    ? 'Processing your research paper'
                    : 'Drag and drop or click to upload a research paper'}
                </p>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-accent-error text-sm"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeOut' }}
                className="absolute bottom-0 left-0 h-1 bg-text-primary"
              />
            )}
          </motion.div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              {
                title: 'Extract Concepts',
                description: 'AI identifies key technical concepts',
              },
              {
                title: 'Generate Videos',
                description: '3Blue1Brown-style animations',
              },
              {
                title: 'Code Examples',
                description: 'Runnable Python implementations',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                className="card text-center"
              >
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
