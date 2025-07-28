"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Code, Video, ChevronDown, ChevronUp, BookOpen } from "lucide-react"

// Mock data for demonstration
const mockConcepts = [
  {
    id: 1,
    title: "Transformer Architecture",
    description:
      "The paper introduces a novel attention mechanism that replaces recurrent layers commonly used in encoder-decoder architectures, allowing for significantly more parallelization and reducing training time.",
    tags: ["Deep Learning", "NLP", "Attention Mechanism"],
    hasCode: true,
    hasVideo: true,
    confidence: 0.95,
  },
  {
    id: 2,
    title: "Self-Attention Mechanism",
    description:
      "A mechanism that relates different positions of a single sequence to compute a representation of the sequence. The self-attention mechanism allows the model to focus on different parts of the input sequence when producing the output.",
    tags: ["Attention", "Neural Networks"],
    hasCode: true,
    hasVideo: true,
    confidence: 0.92,
  },
  {
    id: 3,
    title: "Multi-Head Attention",
    description:
      "Instead of performing a single attention function, the paper proposes to linearly project the queries, keys and values multiple times with different learned projections, and perform attention in parallel.",
    tags: ["Parallel Processing", "Feature Learning"],
    hasCode: true,
    hasVideo: false,
    confidence: 0.88,
  },
]

export function ConceptList() {
  const [expandedConcept, setExpandedConcept] = useState<number | null>(null)

  const toggleExpand = (id: number) => {
    setExpandedConcept(expandedConcept === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {mockConcepts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-600 mb-2">No concepts yet</h3>
          <p className="text-slate-500">Upload a paper to extract key concepts</p>
        </div>
      ) : (
        mockConcepts.map((concept) => (
          <Card key={concept.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-800 text-lg">{concept.title}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {(concept.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      
                      {expandedConcept === concept.id && (
                        <div className="mt-3 text-slate-600 leading-relaxed">
                          <p>{concept.description}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {concept.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleExpand(concept.id)}
                    className="ml-2 flex-shrink-0"
                  >
                    {expandedConcept === concept.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="px-4 py-3 bg-slate-50/50 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full">
                {concept.hasCode && (
                  <Button variant="outline" size="sm" className="h-8 bg-white hover:bg-slate-50">
                    <Code className="h-3.5 w-3.5 mr-1" />
                    View Code
                  </Button>
                )}
                {concept.hasVideo && (
                  <Button variant="outline" size="sm" className="h-8 bg-white hover:bg-slate-50">
                    <Video className="h-3.5 w-3.5 mr-1" />
                    Watch Explanation
                  </Button>
                )}
                <div className="ml-auto text-xs text-slate-500">
                  Concept #{concept.id}
                </div>
              </div>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  )
}
