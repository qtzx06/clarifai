"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react"

// Mock data for demonstration
const mockVideos = [
  {
    id: "transformer",
    title: "Transformer Architecture Explained",
    duration: "8:24",
    thumbnail: "/placeholder.svg?height=480&width=640",
  },
  {
    id: "self-attention",
    title: "Self-Attention Mechanism Visualized",
    duration: "5:12",
    thumbnail: "/placeholder.svg?height=480&width=640",
  },
  {
    id: "multi-head",
    title: "Understanding Multi-Head Attention",
    duration: "6:45",
    thumbnail: "/placeholder.svg?height=480&width=640",
  },
]

export function VideoExplanation() {
  const [selectedVideo, setSelectedVideo] = useState(mockVideos[0].id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(30)
  const [volume, setVolume] = useState(80)

  const video = mockVideos.find((v) => v.id === selectedVideo)

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Select Concept to Visualize</label>
        <Select value={selectedVideo} onValueChange={setSelectedVideo}>
          <SelectTrigger>
            <SelectValue placeholder="Select video" />
          </SelectTrigger>
          <SelectContent>
            {mockVideos.map((video) => (
              <SelectItem key={video.id} value={video.id}>
                {video.title} ({video.duration})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <img src={video?.thumbnail || "/placeholder.svg"} alt={video?.title} className="w-full h-full object-cover" />

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlay}
              className="h-16 w-16 rounded-full bg-background/20 backdrop-blur-sm border-white text-white hover:bg-background/30 hover:text-white"
            >
              <Play className="h-8 w-8 ml-1" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">2:31</span>
          <Slider
            value={[progress]}
            max={100}
            step={1}
            className="flex-1"
            onValueChange={(value) => setProgress(value[0])}
          />
          <span className="text-sm text-muted-foreground">{video?.duration}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePlay} className="h-10 w-10">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[volume]}
              max={100}
              step={1}
              className="w-24"
              onValueChange={(value) => setVolume(value[0])}
              disabled={isMuted}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <h3 className="font-medium text-lg">{video?.title}</h3>
        <p className="text-muted-foreground text-sm mt-1">
          This visualization explains how the {video?.id.split("-").join(" ")} works using animated diagrams and
          step-by-step breakdowns.
        </p>
      </div>
    </div>
  )
}
