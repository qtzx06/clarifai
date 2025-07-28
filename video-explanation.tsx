"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize } from "lucide-react"

export function VideoExplanation() {
  const [selectedConcept, setSelectedConcept] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(30)
  const [duration, setDuration] = useState(151)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleVolumeToggle = () => {
    setIsMuted(!isMuted)
  }

  return (
    <div className="space-y-4">
      {/* Concept Selector */}
      <div>
        <label className="text-sm font-medium mb-2 block text-slate-700">
          Select Concept to Visualize
        </label>
        <Select value={selectedConcept} onValueChange={setSelectedConcept}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a concept..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transformer">Transformer Architecture</SelectItem>
            <SelectItem value="attention">Self-Attention Mechanism</SelectItem>
            <SelectItem value="multihead">Multi-Head Attention</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <img 
          src="/placeholder.svg?height=480&width=640" 
          alt="Transformer Architecture Explained" 
          className="w-full h-full object-cover"
        />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Button 
            onClick={handlePlayPause}
            className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm border-white text-white hover:bg-white/30"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
        </div>

        {/* Video Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                onValueChange={(value) => setCurrentTime(value[0])}
                max={duration}
                className="flex-1"
              />
              <span className="text-white text-sm">{formatTime(duration)}</span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePlayPause}
                  className="text-white hover:bg-white/20"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleVolumeToggle}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={(value) => setVolume(value[0])}
                  max={100}
                  className="w-24"
                />
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-lg text-slate-800">
          Transformer Architecture Explained
        </h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          This visualization explains how the transformer works using animated diagrams and step-by-step breakdowns. 
          Learn about the key components including self-attention, multi-head attention, and the overall architecture.
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Duration: {formatTime(duration)}</span>
          <span>•</span>
          <span>HD Quality</span>
          <span>•</span>
          <span>AI Generated</span>
        </div>
      </div>
    </div>
  )
} 