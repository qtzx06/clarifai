"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Code, Video, ChevronDown, ChevronUp, Loader2 } from "lucide-react"

const API_BASE = "http://localhost:8000"

interface Concept {
  id: string
  name: string
  description: string
  importance_score: number
  page_numbers: number[]
  text_snippets: string[]
  related_concepts: string[]
}

interface ConceptListProps {
  paperId?: string
  onGenerateVideo?: (conceptId: string) => void
}

export function ConceptList({ paperId, onGenerateVideo }: ConceptListProps) {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null)
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedConcept(expandedConcept === id ? null : id)
  }

  const fetchConcepts = async () => {
    if (!paperId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/concepts`)
      if (!response.ok) {
        throw new Error('Failed to fetch concepts')
      }

      const data = await response.json()
      setConcepts(data.concepts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load concepts')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateVideo = async (conceptId: string) => {
    if (!paperId) return

    setGeneratingVideo(conceptId)
    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quality: 'medium_quality',
          regenerate: false
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to start video generation')
      }

      onGenerateVideo?.(conceptId)
      
      // Show success message or navigate to video section
      alert('Video generation started! Check the video section for progress.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate video')
    } finally {
      setGeneratingVideo(null)
    }
  }

  const handleClarifyText = async (text: string) => {
    if (!paperId) return

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_snippet: text,
          context: 'User requested clarification'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get clarification')
      }

      const data = await response.json()
      alert(`Clarification: ${data.explanation}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to get clarification')
    }
  }

  useEffect(() => {
    if (paperId) {
      fetchConcepts()
      
      // Set up continuous polling until concepts are found
      const pollInterval = setInterval(() => {
        if (concepts.length === 0) {
          fetchConcepts()
        } else {
          clearInterval(pollInterval)
        }
      }, 2000) // Poll every 2 seconds
      
      // Clean up interval on unmount
      return () => clearInterval(pollInterval)
    }
  }, [paperId, concepts.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading concepts...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchConcepts} variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {concepts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {paperId ? "No concepts extracted yet. Try analyzing the paper first." : "Upload a paper to extract key concepts"}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {concepts.length} concepts extracted
            </span>
            <Button 
              onClick={fetchConcepts} 
              variant="ghost" 
              size="sm"
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          
          {concepts.map((concept) => (
            <Card key={concept.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{concept.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Score: {(concept.importance_score * 100).toFixed(0)}%
                        </Badge>
                        {concept.page_numbers.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Pages: {concept.page_numbers.join(', ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(concept.id)} className="ml-2">
                    {expandedConcept === concept.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {expandedConcept === concept.id && (
                  <div className="mt-3 text-muted-foreground">
                    <p className="mb-3">{concept.description}</p>
                    
                    {concept.text_snippets.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-700">Key Excerpts:</h4>
                        {concept.text_snippets.slice(0, 2).map((snippet, index) => (
                          <div 
                            key={index}
                            className="bg-slate-50 p-2 rounded text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => handleClarifyText(snippet)}
                            title="Click to get clarification"
                          >
                            "{snippet.substring(0, 200)}..."
                          </div>
                        ))}
                      </div>
                    )}

                    {concept.related_concepts.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Related Concepts:</h4>
                        <div className="flex flex-wrap gap-1">
                          {concept.related_concepts.map((related) => (
                            <Badge key={related} variant="outline" className="text-xs">
                              {related}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="px-4 py-2 bg-muted/50 flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 bg-transparent"
                  onClick={() => handleClarifyText(concept.description)}
                >
                  <Lightbulb className="h-3.5 w-3.5 mr-1" />
                  Clarify
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 bg-transparent"
                  onClick={() => handleGenerateVideo(concept.id)}
                  disabled={generatingVideo === concept.id}
                >
                  {generatingVideo === concept.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Video className="h-3.5 w-3.5 mr-1" />
                  )}
                  {generatingVideo === concept.id ? 'Generating...' : 'Generate Video'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
