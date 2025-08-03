"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface PDFViewerProps {
  paperId: string
  filename?: string
}

export function PDFViewer({ paperId, filename }: PDFViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.0)

  const pdfUrl = `http://localhost:8000/api/papers/${paperId}/pdf`

  const handleLoad = () => {
    setLoading(false)
    setError(null)
  }

  const handleError = () => {
    setLoading(false)
    setError("Failed to load PDF. Please try refreshing the page.")
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const resetZoom = () => {
    setScale(1.0)
  }

  const downloadPDF = () => {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = filename || 'research-paper.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-slate-900">PDF Viewer</h4>
          <Button onClick={downloadPDF} variant="outline" size="sm">
            📥 Download PDF
          </Button>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-2">⚠️ PDF Load Error</div>
          <p className="text-sm text-red-700">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* PDF Controls */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-900">PDF Viewer</h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              onClick={zoomOut}
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={scale <= 0.5}
            >
              −
            </Button>
            <span className="text-xs px-2 text-slate-600">
              {Math.round(scale * 100)}%
            </span>
            <Button
              onClick={zoomIn}
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={scale >= 3.0}
            >
              +
            </Button>
          </div>
          <Button onClick={resetZoom} variant="outline" size="sm">
            Reset
          </Button>
          <Button onClick={downloadPDF} variant="outline" size="sm">
            📥 Download
          </Button>
        </div>
      </div>

      {/* PDF Viewer Container */}
      <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex items-center gap-2 text-slate-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Loading PDF...</span>
            </div>
          </div>
        )}
        
        <div className="overflow-auto max-h-[600px]">
          <iframe
            src={pdfUrl}
            className="w-full min-h-[600px] border-0"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${100 / scale}%`,
              height: `${600 / scale}px`
            }}
            onLoad={handleLoad}
            onError={handleError}
            title={`PDF Viewer - ${filename || 'Research Paper'}`}
          />
        </div>
      </div>

      {/* PDF Info */}
      <div className="text-xs text-slate-500 text-center">
        {filename && (
          <span>📄 {filename}</span>
        )}
        {loading && (
          <span className="ml-2">• Loading...</span>
        )}
      </div>
    </div>
  )
}