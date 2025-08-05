"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Download, Trash2, Bot, Sparkles, AlertTriangle, Server, Film } from "lucide-react"

const API_BASE = "http://localhost:8000"
const WS_BASE = "ws://localhost:8000"

// --- Helper Components ---

const LogMessage = ({ message }: { message: string }) => {
  const getMessageStyle = () => {
    if (message.startsWith("--- PROMPT")) return "bg-blue-50 border-blue-200 text-blue-800"
    if (message.startsWith("--- AI RESPONSE")) return "bg-green-50 border-green-200 text-green-800"
    if (message.startsWith("--- Starting Attempt")) return "font-bold text-center my-2 text-slate-600"
    if (message.startsWith("--- All")) return "bg-red-100 border-red-300 text-red-800 font-bold"
    if (message.includes("STDERR") || message.includes("FATAL") || message.includes("Agent crashed")) return "bg-red-50 border-red-200 text-red-700"
    return "bg-slate-50 text-slate-600"
  }
  
  const getIcon = () => {
    if (message.startsWith("--- PROMPT")) return <Bot className="h-5 w-5 mr-3 text-blue-600 flex-shrink-0" />
    if (message.startsWith("--- AI RESPONSE")) return <Sparkles className="h-5 w-5 mr-3 text-green-600 flex-shrink-0" />
    if (message.includes("STDERR") || message.includes("FATAL") || message.includes("Agent crashed")) return <AlertTriangle className="h-5 w-5 mr-3 text-red-600 flex-shrink-0" />
    if (message.startsWith("---")) return null // No icon for attempt headers
    return <Server className="h-5 w-5 mr-3 text-slate-500 flex-shrink-0" />
  }

  return (
    <div className={`p-3 rounded-lg border text-xs my-1 flex items-start font-mono ${getMessageStyle()}`}>
      {getIcon()}
      <pre className="whitespace-pre-wrap break-words flex-grow overflow-x-auto">{message}</pre>
    </div>
  )
}

// --- Main Component ---

interface VideoExplanationProps {
  paperId?: string
  videoGenerationRequest?: {conceptId: string, conceptName: string} | null
  onVideoGenerated?: () => void
}

interface GeneratedVideo {
  conceptId: string
  conceptName: string
  videoUrl: string
}

export function VideoExplanation({
  paperId,
  videoGenerationRequest,
  onVideoGenerated,
}: VideoExplanationProps) {
  const [currentGeneratingConcept, setCurrentGeneratingConcept] = useState<{id: string, name: string} | null>(null)
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  // Effect to establish and manage WebSocket connection
  useEffect(() => {
    if (paperId) {
      ws.current = new WebSocket(`${WS_BASE}/ws/papers/${paperId}/logs`);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setLogs(prev => [...prev, data.message]);
        }
      };

      ws.current.onclose = () => console.log("WebSocket disconnected.");
      ws.current.onerror = (error) => console.error("WebSocket error:", error);

      return () => ws.current?.close();
    }
  }, [paperId]);

  // Effect to start a new video generation
  useEffect(() => {
    if (videoGenerationRequest && paperId) {
      setLogs([`--- Starting generation for '${videoGenerationRequest.conceptName}' ---`])
      setIsGenerating(true)
      setIsFinished(false)
      setCurrentGeneratingConcept({id: videoGenerationRequest.conceptId, name: videoGenerationRequest.conceptName})
      generateVideoForConcept(videoGenerationRequest.conceptId)
      onVideoGenerated?.()
    }
  }, [videoGenerationRequest, paperId])
  
  // Effect for smart scrolling
  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  // Effect to poll for the final status (completed/failed)
  useEffect(() => {
    if (!isGenerating || !paperId || !currentGeneratingConcept) return;

    const pollFinalStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/papers/${paperId}/concepts/${currentGeneratingConcept.id}/video/status`);
            if(response.ok) {
                const data = await response.json();
                if(data.video_status === 'completed' || data.video_status === 'failed') {
                    setIsFinished(true);
                    setIsGenerating(false);
                     if (data.video_status === 'completed' && data.video_path) {
                        const completedVideo: GeneratedVideo = {
                          conceptId: currentGeneratingConcept.id,
                          conceptName: currentGeneratingConcept.name,
                          videoUrl: `${API_BASE}${data.video_path}`,
                        }
                        setGeneratedVideos(prev => [...prev, completedVideo])
                      }
                }
            }
        } catch (error) {
            console.error("Failed to poll final status:", error);
        }
    };

    const interval = setInterval(pollFinalStatus, 3000);
    return () => clearInterval(interval);
  }, [isGenerating, paperId, currentGeneratingConcept]);


  const generateVideoForConcept = async (conceptId: string) => {
    if (!paperId) return
    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/concepts/${conceptId}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept_id: conceptId }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setLogs(prev => [...prev, errorData.detail || 'Failed to start video generation'])
        setIsFinished(true)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'
      setLogs(prev => [...prev, errorMessage])
      setIsFinished(true)
    }
  }

  if (!paperId) {
    return (
      <div className="relative aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Film className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm">
            Upload a paper to generate video explanations
          </p>
        </div>
      </div>
    )
  }

  if (isGenerating || isFinished) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 h-[520px] flex flex-col bg-slate-50">
        <h3 className="text-lg font-semibold text-center mb-2 flex-shrink-0">
          {isGenerating ? `Generating Video: ${currentGeneratingConcept?.name}` : `Finished: ${currentGeneratingConcept?.name}`}
        </h3>
        <div ref={logsContainerRef} className="bg-white rounded-lg p-3 flex-grow overflow-y-auto border">
          {logs.map((log, index) => (
            <LogMessage key={index} message={log} />
          ))}
        </div>
        {isFinished && (
            <Button 
              onClick={() => {setIsGenerating(false); setIsFinished(false)}} 
              variant="outline"
              className="w-full mt-2 flex-shrink-0 bg-white text-slate-600 hover:bg-slate-100"
            >
              Close
            </Button>
        )}
      </div>
    )
  }

  if (generatedVideos.length === 0) {
    return (
      <div className="relative aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Film className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-sm">
            Click "Video" on a concept to generate an explanation
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {generatedVideos.map((video) => (
        <div key={video.conceptId} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-medium text-slate-900">{video.conceptName}</h4>
            <div className="flex items-center gap-2">
                <Button onClick={() => window.open(video.videoUrl, '_blank')} variant="ghost" size="sm"><Download className="h-4 w-4"/></Button>
                <Button onClick={() => setGeneratedVideos(v => v.filter(v => v.conceptId !== video.conceptId))} variant="ghost" size="sm"><Trash2 className="h-4 w-4"/></Button>
            </div>
          </div>
          <div className="relative">
            <video className="w-full aspect-video bg-black" controls autoPlay muted>
              <source src={video.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      ))}
    </div>
  )
}
