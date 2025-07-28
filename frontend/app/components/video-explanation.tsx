"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  RefreshCw,
  AlertCircle,
  Loader2
} from "lucide-react"

const API_BASE = "http://localhost:8000"

interface VideoExplanationProps {
  paperId?: string
}

interface VideoStatus {
  paper_id: string
  video_status: string
  video_path?: string
  clips_count: number
  clips_paths: string[]
  has_video_config: boolean
}

export function VideoExplanation({ paperId }: VideoExplanationProps) {
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(80)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuality, setSelectedQuality] = useState("medium_quality")

  const fetchVideoStatus = async () => {
    if (!paperId) return

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/video/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch video status')
      }

      const data = await response.json()
      setVideoStatus(data)
      
      // If video is generating, continue polling
      if (data.video_status === 'generating') {
        setTimeout(fetchVideoStatus, 3000) // Poll every 3 seconds
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video status')
    }
  }

  const generateVideo = async () => {
    if (!paperId) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paper_id: paperId,
          quality: selectedQuality,
          regenerate: false
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start video generation')
      }

      // Start polling for status
      fetchVideoStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadVideo = async () => {
    if (!paperId || !videoStatus?.video_path) return

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/video/download`)
      if (!response.ok) {
        throw new Error('Failed to download video')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${paperId}_educational_video.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download video')
    }
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  // Fetch video status when component mounts or paperId changes
  useEffect(() => {
    if (paperId) {
      setLoading(true)
      fetchVideoStatus().finally(() => setLoading(false))
    } else {
      setVideoStatus(null)
      setError(null)
    }
  }, [paperId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading video status...</span>
      </div>
    )
  }

  if (!paperId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎥</span>
        </div>
        <p>Upload a paper to generate educational videos</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Video Generation Controls */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Video Quality</label>
          <Select value={selectedQuality} onValueChange={setSelectedQuality}>
            <SelectTrigger>
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low_quality">Low Quality (Fast)</SelectItem>
              <SelectItem value="medium_quality">Medium Quality</SelectItem>
              <SelectItem value="high_quality">High Quality (Slow)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={generateVideo}
            disabled={isGenerating || videoStatus?.video_status === 'generating'}
            className="flex-1"
          >
            {isGenerating || videoStatus?.video_status === 'generating' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Video
              </>
            )}
          </Button>

          {videoStatus?.video_path && (
            <Button
              onClick={downloadVideo}
              variant="outline"
              size="icon"
              title="Download video"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Video Status */}
      {videoStatus && (
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Video Status:</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              videoStatus.video_status === 'completed'
                ? 'bg-green-100 text-green-700'
                : videoStatus.video_status === 'generating'
                ? 'bg-yellow-100 text-yellow-700'
                : videoStatus.video_status === 'failed'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {videoStatus.video_status}
            </span>
          </div>
          
          {videoStatus.clips_count > 0 && (
            <div className="text-sm text-muted-foreground">
              Generated {videoStatus.clips_count} video clip{videoStatus.clips_count === 1 ? '' : 's'}
            </div>
          )}

          {videoStatus.video_status === 'generating' && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Generating video clips...</div>
              <Progress value={33} className="h-2" />
            </div>
          )}
        </div>
      )}

      {/* Video Player */}
      {videoStatus?.video_path ? (
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              className="w-full h-full"
              src={`${API_BASE}/videos/${videoStatus.video_path.split('/').pop()}`}
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e) => {
                const video = e.target as HTMLVideoElement
                const progress = (video.currentTime / video.duration) * 100
                setProgress(progress || 0)
              }}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="pt-2">
            <h3 className="font-medium text-lg">Educational Video Generated</h3>
            <p className="text-muted-foreground text-sm mt-1">
              AI-generated video explanation of key concepts from the research paper using Manim animations.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <p className="text-sm">
              {videoStatus?.video_status === 'generating'
                ? 'Video is being generated...'
                : 'Click "Generate Video" to create educational content'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
