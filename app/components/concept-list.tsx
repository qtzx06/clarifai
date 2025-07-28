"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, Video, ChevronDown, ChevronUp } from "lucide-react"

// Mock data for demonstration
const mockConcepts = [
  {
    id: 1,
    title: "Transformer Architecture",
    description:
      "The paper introduces a novel attention mechanism that replaces recurrent layers commonly used in encoder-decoder architectures, allowing for significantly more parallelization and reducing training time.",
    tags: ["Deep Learning", "NLP", "Attention Mechanism"],
    hasVideo: true,
  },
  {
    id: 2,
    title: "Self-Attention Mechanism",
    description:
      "A mechanism that relates different positions of a single sequence to compute a representation of the sequence. The self-attention mechanism allows the model to focus on different parts of the input sequence when producing the output.",
    tags: ["Attention", "Neural Networks"],
    hasVideo: true,
  },
  {
    id: 3,
    title: "Multi-Head Attention",
    description:
      "Instead of performing a single attention function, the paper proposes to linearly project the queries, keys and values multiple times with different learned projections, and perform attention in parallel.",
    tags: ["Parallel Processing", "Feature Learning"],
    hasVideo: false,
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
        <div className="text-center py-8 text-muted-foreground">Upload a paper to extract key concepts</div>
      ) : (
        mockConcepts.map((concept) => (
          <Card key={concept.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  <h3 className="font-medium text-lg">{concept.title}</h3>
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
                  <p>{concept.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {concept.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="px-4 py-2 bg-muted/50 flex flex-wrap gap-2">
              {concept.hasVideo && (
                <Button variant="outline" size="sm" className="h-8 bg-transparent">
                  <Video className="h-3.5 w-3.5 mr-1" />
                  Watch Explanation
                </Button>
              )}
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  )
}
