"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, X, CheckCircle } from "lucide-react"

const API_BASE = "http://localhost:8000"

interface Paper {
  id: string
  title: string
  authors: string[]
  abstract: string
  analysis_status: string
}

interface FileUploaderProps {
  onPaperUploaded?: (paper: Paper) => void
}

export function FileUploader({ onPaperUploaded }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedPaper, setUploadedPaper] = useState<Paper | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0)

  const processingMessages = [
    "Processing paper...",
    "Hold tight!",
    "Analyzing content...",
    "Almost there!",
    "Extracting insights...",
    "Working on it!",
    "Generating concepts...",
    "Just a moment more!",
    "AI is thinking...",
    "Nearly done!",
    "Finalizing analysis...",
    "Coming together!"
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file')
        return
      }
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        setError('File size must be less than 50MB')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Upload progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const result = await response.json()
      
      // Poll for paper processing completion
      await pollPaperStatus(result.paper_id)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      setProgress(0)
    }
  }

  const pollPaperStatus = async (paperId: string) => {
    try {
      let attempts = 0
      const maxAttempts = 60 // 60 seconds max for analysis to complete

      // Start the processing message rotation
      const messageInterval = setInterval(() => {
        setProcessingMessageIndex(prev => (prev + 1) % processingMessages.length)
      }, 5000) // Change message every 5 seconds

      const poll = async () => {
        if (attempts >= maxAttempts) {
          clearInterval(messageInterval)
          throw new Error('Processing timeout')
        }

        const response = await fetch(`${API_BASE}/api/papers/${paperId}`)
        if (!response.ok) {
          clearInterval(messageInterval)
          throw new Error('Failed to fetch paper status')
        }

        const paper = await response.json()
        
        // Check if paper has been parsed AND has concepts (meaning analysis is done)
        if (paper.analysis_status === 'completed' && paper.content) {
          clearInterval(messageInterval)
          // Always trigger the paper upload callback to show the interface
          setUploadedPaper(paper)
          setUploading(false)
          onPaperUploaded?.(paper)
          return
        }

        if (paper.analysis_status === 'failed') {
          clearInterval(messageInterval)
          throw new Error('Paper processing failed')
        }

        attempts++
        setTimeout(poll, 1000) // Poll every second
      }

      await poll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setProgress(0)
    setUploading(false)
    setUploadedPaper(null)
    setError(null)
  }

  const startNewUpload = () => {
    removeFile()
  }

  if (uploadedPaper) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800">Ready for Analysis</h3>
              <p className="text-sm text-green-700 mt-1">
                {uploadedPaper.title || file?.name}
              </p>
              {uploadedPaper.authors.length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  by {uploadedPaper.authors.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
        <Button onClick={startNewUpload} variant="outline" className="w-full">
          Upload Another Paper
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold mb-2">Upload Research Paper</h2>
        <p className="text-muted-foreground">
          Upload a PDF research paper to extract key concepts and generate insights
        </p>
      </div>

      {error && (
        <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!file ? (
        <div className="w-full max-w-md">
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PDF (MAX. 50MB)</p>
            </div>
            <Input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center p-3 bg-muted rounded-lg">
            <FileText className="h-8 w-8 mr-3 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button variant="ghost" size="icon" onClick={removeFile} disabled={uploading}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {uploading && (
           <div className="space-y-2">
             <Progress value={progress} className="h-2 w-full" />
             <p className="text-sm text-center text-muted-foreground transition-all duration-500">
               {progress < 90 ? 'Uploading...' : processingMessages[processingMessageIndex]}
             </p>
           </div>
         )}

          <div className="flex justify-center">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-2 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              {uploading ? (progress < 90 ? "Uploading..." : "Processing...") : "Analyze Paper"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}