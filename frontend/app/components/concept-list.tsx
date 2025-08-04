"use client"

import { useState, useEffect } from 'react'
import { Trash2, Play, Code, MessageCircle } from 'lucide-react'
import { LoadingButton } from './loading-button'
import { LoadingCard, LoadingProgress } from './loading-card'

// Simple UI Components - no external dependencies
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
    {children}
  </div>
)

const CardHeader = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`p-6 pb-4 ${className}`}>{children}</div>
)

const CardContent = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`px-6 pb-6 ${className}`}>{children}</div>
)

const CardTitle = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
)

const CardDescription = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <p className={`text-sm text-gray-600 ${className}`}>{children}</p>
)

const Button = ({
  children,
  onClick,
  disabled = false,
  variant = "default",
  size = "default",
  className = ""
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm"
  className?: string
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
  
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground"
  }
  
  const sizeClasses = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3"
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  )
}

interface Concept {
  id: string
  name: string
  description: string
  importance_score: number
  mathematical_visualization: boolean
  isNew?: boolean
}

interface ConceptListProps {
  paperId: string | null
  concepts: Concept[]
  onUpdateConcepts: (concepts: Concept[]) => void
  onGenerateVideo: (conceptId: string, conceptName: string) => void
  onGenerateCode: (conceptId: string, conceptName: string) => void
  onClarifyQuestion: (question: string) => void
  codeGeneratingFor: string | null
  videoGeneratingFor?: string | null
  questionGeneratingFor?: string | null
  analysisStatus: string
}

export function ConceptList({
  paperId,
  concepts,
  onUpdateConcepts,
  onGenerateVideo,
  onGenerateCode,
  onClarifyQuestion,
  codeGeneratingFor,
  videoGeneratingFor = null,
  questionGeneratingFor = null,
  analysisStatus
}: ConceptListProps) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteConcept = async (conceptId: string) => {
    if (!paperId) return;

    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/concepts/${conceptId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdateConcepts(concepts.filter(c => c.id !== conceptId));
        console.log(`Deleted concept ${conceptId}`);
      } else {
        setError('Failed to delete concept.');
      }
    } catch (err) {
      console.error('Delete concept error:', err);
      setError('Failed to delete concept.');
    }
  };

  const generateMoreConcepts = async () => {
    if (!paperId || generating) return;

    setGenerating(true);

    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/generate-additional-concept`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.new_concept) {
          onUpdateConcepts(prev => [...prev, data.new_concept]);
        } else {
          setError('Failed to generate a new concept.');
        }
      } else {
        setError('Failed to generate a new concept.');
      }
    } catch (err) {
      console.error('Generate concept error:', err);
      setError('Failed to generate a new concept.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Key Concepts</h2>
        <Button
          onClick={generateMoreConcepts}
          disabled={generating}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating...
            </>
          ) : (
            'Generate More Concepts'
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="bg-slate-100 rounded-lg p-6">
        {analysisStatus === 'processing' && concepts.length === 0 ? (
          <LoadingCard
            title="Analyzing paper..."
            message="Extracting key concepts"
            showSpinner={true}
          >
            <div className="mt-4 w-full max-w-xs mx-auto">
              <LoadingProgress progress={70} message="Almost there..." />
            </div>
          </LoadingCard>
        ) : concepts.length === 0 ? (
          <p className="text-gray-500 text-center">No concepts yet. Click "Generate More Concepts" to add some.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {concepts.map((concept) => (
              <Card key={concept.id} className="relative group flex flex-col h-full">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{concept.name}</CardTitle>
                      <CardDescription className="text-sm mt-2">
                        {concept.description}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteConcept(concept.id)}
                      className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-end">
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>Importance: {Math.round(concept.importance_score * 100)}%</span>
                    {concept.mathematical_visualization && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        Mathematical
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LoadingButton
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateVideo(concept.id, concept.name)}
                      className="flex-1"
                      loading={videoGeneratingFor === concept.id}
                      loadingText="..."
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Video
                    </LoadingButton>
                    <LoadingButton
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateCode(concept.id, concept.name)}
                      className="flex-1"
                      loading={codeGeneratingFor === concept.id}
                      loadingText="..."
                    >
                      <Code className="w-4 h-4 mr-1" />
                      Code
                    </LoadingButton>
                    <LoadingButton
                      variant="outline"
                      size="sm"
                      onClick={() => onClarifyQuestion(`Explain the concept: ${concept.name}`)}
                      className="flex-1"
                      loading={questionGeneratingFor === concept.id}
                      loadingText="..."
                    >
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Ask
                    </LoadingButton>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}