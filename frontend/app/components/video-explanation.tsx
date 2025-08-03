"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Trash2, Loader2 } from "lucide-react"
import { LoadingCard, LoadingProgress } from './loading-card'

const API_BASE = "http://localhost:8000"

interface VideoExplanationProps {
  paperId?: string
  videoGenerationRequest?: {conceptId: string, conceptName: string} | null
  onVideoGenerated?: () => void
  videoGeneratingFor?: string | null
}

interface VideoStatus {
  paper_id: string
  video_status: string
  video_path?: string
  clips_count: number
  clips_paths: string[]
  has_video_config: boolean
}

interface GeneratedVideo {
  conceptId: string
  conceptName: string
  videoUrl: string
  status: string
}

export function VideoExplanation({
  paperId,
  videoGenerationRequest,
  onVideoGenerated,
  videoGeneratingFor
}: VideoExplanationProps) {
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [analysisStatus, setAnalysisStatus] = useState<string>('pending')
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)
  const [generatingStep, setGeneratingStep] = useState('')

  useEffect(() => {
    if (paperId) {
      setGeneratedVideos([])
      setAnalysisStatus('pending')
      setVideoStatus(null)
      setIsGenerating(false)
      
      const checkStatus = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/papers/${paperId}/status`)
          if (response.ok) {
            const data = await response.json()
            setAnalysisStatus(data.analysis_status)
          }
        } catch (err) {
          console.error('Failed to fetch status:', err)
        }
      }
      
      checkStatus()
      const interval = setInterval(checkStatus, 3000)
      return () => clearInterval(interval)
    } else {
      setGeneratedVideos([])
      setAnalysisStatus('pending')
      setVideoStatus(null)
      setIsGenerating(false)
    }
  }, [paperId])

  const fetchConceptVideoStatus = async (conceptId: string): Promise<any | null> => {
    if (!paperId) return null

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/concepts/${conceptId}/video/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch concept video status')
      }

      const data = await response.json()
      return data
    } catch (err) {
      console.error('Failed to fetch concept video status:', err)
      return null
    }
  }

  const fetchVideoStatus = async (): Promise<VideoStatus | null> => {
    if (!paperId) return null

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/video/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch video status')
      }

      const data = await response.json()
      setVideoStatus(data)
      return data
    } catch (err) {
      console.error('Failed to fetch video status:', err)
      return null
    }
  }

  // Handle video generation requests from parent - WORKING VERSION
  useEffect(() => {
    if (videoGenerationRequest) {
      generateVideoForConcept(videoGenerationRequest.conceptId, videoGenerationRequest.conceptName)
      onVideoGenerated?.()
    }
  }, [videoGenerationRequest, onVideoGenerated])

  const generateVideoForConcept = async (conceptId: string, conceptName: string) => {
    setIsGenerating(true)
    setGeneratingProgress(0)
    setGeneratingStep('Starting video generation...')
    
    try {
      // Start backend generation - SINGLE VIDEO MODE
      console.log('🚀 Starting video generation for:', conceptName)
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/concepts/${conceptId}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          concept_id: conceptId,
          concept_name: conceptName,
          quality: "medium_quality",
          regenerate: false
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || 'Failed to start video generation'
        
        if (response.status === 400) {
          // Show error message to user - video already in progress
          alert(`⚠️ ${errorMessage}`)
          setIsGenerating(false)
          return
        }
        
        throw new Error(errorMessage)
      }

      console.log('✅ Backend generation started, now polling...')

      // Progress simulation for Manim rendering (~45 seconds)
      const runProgressSimulation = async () => {
        const steps = [
          { progress: 10, step: 'Analyzing concept complexity...', delay: 3000 },
          { progress: 20, step: 'Generating optimized Manim code...', delay: 5000 },
          { progress: 30, step: 'Setting up LaTeX environment...', delay: 4000 },
          { progress: 45, step: 'Parsing mathematical expressions...', delay: 4000 },
          { progress: 60, step: 'Creating scene animations...', delay: 6000 },
          { progress: 75, step: 'Rendering video frames with Manim...', delay: 8000 },
          { progress: 85, step: 'Processing mathematical visuals...', delay: 6000 },
          { progress: 92, step: 'Optimizing video quality...', delay: 4000 },
          { progress: 98, step: 'Finalizing video output...', delay: 3000 },
          { progress: 100, step: 'Video done! About to play...', delay: 2000 }
        ]
        
        for (const { progress, step, delay } of steps) {
          await new Promise(resolve => setTimeout(resolve, delay))
          setGeneratingProgress(progress)
          setGeneratingStep(step)
        }
      }
      
      // Start progress simulation
      runProgressSimulation()

      // Poll for completion - BACK TO PAPER-LEVEL STATUS (SINGLE VIDEO MODE)
      let attempts = 0
      const maxAttempts = 60 // 5 minutes max
      
      const pollInterval = setInterval(async () => {
        attempts++
        console.log(`🔍 Polling attempt ${attempts}/${maxAttempts}`)
        
        const status = await fetchVideoStatus()
        if (status) {
          console.log(`📊 Paper Status: ${status.video_status}, Path: ${status.video_path}`)
          
          if (status.video_status === 'completed' && status.video_path) {
            console.log('✅ Video generation completed!')
            clearInterval(pollInterval)
            setIsGenerating(false)
            
            // Add completed video to the array like Generated Code
            const filename = status.video_path.split('/').pop() || status.video_path.split('\\').pop()
            const videoId = `${conceptId}_${Date.now()}`
            const videoUrl = `${API_BASE}/videos/${filename}`
            
            const completedVideo: GeneratedVideo = {
              conceptId: videoId,
              conceptName,
              videoUrl: videoUrl,
              status: 'completed'
            }
            
            setGeneratedVideos(prev => [...prev, completedVideo])
            console.log('🎉 Video added to generated videos array!')
            
          } else if (status.video_status === 'failed') {
            console.error('❌ Video generation failed')
            clearInterval(pollInterval)
            setIsGenerating(false)
            
          } else if (attempts >= maxAttempts) {
            console.error('⏰ Video generation timeout after 5 minutes')
            clearInterval(pollInterval)
            setIsGenerating(false)
          }
        }
      }, 3000) // Poll every 3 seconds like clarifai-old
      
    } catch (err) {
      console.error('Failed to generate video:', err)
      setIsGenerating(false)
    }
  }

  const downloadVideo = async (videoUrl: string, conceptName: string) => {
    try {
      const response = await fetch(videoUrl)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `${conceptName.replace(/\s+/g, '_')}_explanation.mp4`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error downloading video:', error)
    }
  }

  const removeVideo = (index: number) => {
    setGeneratedVideos(prev => prev.filter((_, i) => i !== index))
  }

  if (!paperId) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <p className="text-sm">
              Upload a paper to see video explanations
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (analysisStatus === 'processing') {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm">
              Analyzing paper...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Video generation will be available after analysis completes
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (analysisStatus !== 'completed') {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-sm">
              Waiting for analysis to complete
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Video generation requires extracted concepts
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show generating state with existing videos - SINGLE VIDEO MODE
  if (isGenerating || videoGeneratingFor || videoStatus?.video_status === 'generating') {
    return (
      <div className="space-y-6">
        {/* Show existing videos if any */}
        {generatedVideos.map((video, index) => (
          <div key={`${video.conceptId}-${index}`} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Header - Clean like Generated Code */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{video.conceptName}</h4>
                  <p className="text-sm text-slate-600">Video example for the concept: {video.conceptName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => downloadVideo(video.videoUrl, video.conceptName)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-1"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => removeVideo(index)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Video Player */}
            <div className="relative">
              <video
                className="w-full aspect-video bg-black"
                controls
                autoPlay
                muted
                preload="auto"
                onError={(e) => {
                  console.error('Video loading error:', e)
                  console.error('Video URL:', video.videoUrl)
                }}
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        ))}

        {/* Loading Card for Current Generation */}
        <LoadingCard
          title="🔄 Generating video explanation..."
          message={generatingStep || 'Starting video generation...'}
          showSpinner={false}
        >
          <div className="mt-4 w-full max-w-xs">
            <LoadingProgress
              progress={generatingProgress}
              message={generatingStep || 'Initializing...'}
            />
          </div>
        </LoadingCard>
      </div>
    )
  }

  // Show generated videos or empty state
  if (generatedVideos.length === 0) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-slate-500">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <p className="text-sm">
              {videoStatus?.video_status === 'failed'
                ? 'Video generation failed. Try again.'
                : 'Click "Video" to generate educational explanations'
              }
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show all generated videos
  return (
    <div className="space-y-6">
      {generatedVideos.map((video, index) => (
        <div key={`${video.conceptId}-${index}`} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Header - Clean like Generated Code */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{video.conceptName}</h4>
                <p className="text-sm text-slate-600">Video example for the concept: {video.conceptName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => downloadVideo(video.videoUrl, video.conceptName)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-blue-500 hover:bg-blue-50 p-1"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => removeVideo(index)}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Video Player */}
          <div className="relative">
            <video
              className="w-full aspect-video bg-black"
              controls
              autoPlay
              muted
              preload="auto"
              onError={(e) => {
                console.error('Video loading error:', e)
                console.error('Video URL:', video.videoUrl)
              }}
            >
              <source src={video.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      ))}
    </div>
  )
}