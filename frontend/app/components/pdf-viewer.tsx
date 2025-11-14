'use client';

import { useState } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PDFViewerProps {
  paperId: string;
  filename?: string;
}

export function PDFViewer({ paperId, filename }: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const pdfUrl = `${API_URL}/api/papers/${paperId}/pdf`;

  const handleLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleError = () => {
    setLoading(false);
    setError('Failed to load PDF');
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  const downloadPDF = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename || 'research-paper.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">PDF Viewer</h4>
        </div>
        <div className="flex-1 flex items-center justify-center border border-accent-error/30 bg-accent-error/10 rounded-lg">
          <div className="text-center p-6">
            <p className="text-accent-error mb-4">{error}</p>
            <button onClick={downloadPDF} className="btn-secondary text-sm">
              Download PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* PDF Controls */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-sm">PDF Viewer</h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-bg-secondary border border-accent-border rounded-md">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="px-2 py-1 hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-xs px-2 text-text-tertiary min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="px-2 py-1 hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
          <button onClick={resetZoom} className="btn-secondary text-xs py-1 px-2">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={downloadPDF} className="btn-secondary text-xs py-1 px-2">
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* PDF Viewer Container */}
      <div className="relative flex-1 border border-accent-border rounded-lg overflow-hidden bg-bg-secondary">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-10">
            <div className="flex items-center gap-2 text-text-secondary">
              <div className="w-4 h-4 border-2 border-text-tertiary border-t-text-primary rounded-full animate-spin" />
              <span className="text-sm">Loading PDF...</span>
            </div>
          </div>
        )}

        <div className="overflow-auto h-full">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0 bg-bg-primary"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${100 / scale}%`,
              height: `${100 / scale}%`,
            }}
            onLoad={handleLoad}
            onError={handleError}
            title={`PDF Viewer - ${filename || 'Research Paper'}`}
          />
        </div>
      </div>

      {/* PDF Info */}
      {filename && (
        <div className="text-xs text-text-tertiary text-center mt-2">{filename}</div>
      )}
    </div>
  );
}