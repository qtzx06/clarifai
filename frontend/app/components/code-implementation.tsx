"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { LoadingCard, LoadingProgress } from './loading-card'

interface CodeImplementationProps {
  paperId?: string
  codeGenerationRequest?: {conceptId: string, conceptName: string} | null
  onCodeGenerated?: () => void
  codeGeneratingFor?: string | null
}

interface GeneratedCode {
  conceptId: string
  conceptName: string
  code: string
  language: string
  description: string
}

export function CodeImplementation({
  paperId,
  codeGenerationRequest,
  onCodeGenerated,
  codeGeneratingFor
}: CodeImplementationProps) {
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([])
  const [analysisStatus, setAnalysisStatus] = useState<string>('pending')
  const [loading, setLoading] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)
  const [generatingStep, setGeneratingStep] = useState('')

  useEffect(() => {
    if (paperId) {
      // Reset state for new paper
      setGeneratedCodes([])
      setAnalysisStatus('pending')
      setLoading(false)
      
      // Check analysis status
      const checkStatus = async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/papers/${paperId}/status`)
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
      // Reset when no paper
      setGeneratedCodes([])
      setAnalysisStatus('pending')
      setLoading(false)
    }
  }, [paperId])

  // Handle code generation requests from parent
  useEffect(() => {
    if (codeGenerationRequest) {
      generateCodeForConcept(codeGenerationRequest.conceptId, codeGenerationRequest.conceptName)
      onCodeGenerated?.()
    }
  }, [codeGenerationRequest, onCodeGenerated])

  const generateCodeForConcept = async (conceptId: string, conceptName: string) => {
    setLoading(true)
    setGeneratingProgress(0)
    setGeneratingStep('Analyzing concept...')
    
    try {
      // Simulate progress updates during code generation
      const progressSteps = [
        { progress: 25, step: 'Understanding concept requirements...', delay: 800 },
        { progress: 50, step: 'Generating Python implementation...', delay: 1200 },
        { progress: 75, step: 'Adding documentation and examples...', delay: 800 },
        { progress: 100, step: 'Code generation complete!', delay: 400 }
      ]
      
      let cumulativeDelay = 0
      for (const { progress, step, delay } of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, delay))
        setGeneratingProgress(progress)
        setGeneratingStep(step)
      }
      
      const mockCode: GeneratedCode = {
        conceptId,
        conceptName,
        language: "python",
        description: `Implementation example for the concept: ${conceptName}`,
        code: `# ${conceptName} Implementation
# This is a generated code example for understanding ${conceptName}

class ${conceptName.replace(/\s+/g, '')}:
    """
    A class to demonstrate ${conceptName} concepts.
    """
    
    def __init__(self):
        self.initialized = True
        print(f"${conceptName} implementation initialized")
    
    def process(self, data):
        """
        Process data using ${conceptName} methodology
        """
        # Implementation details would go here
        return f"Processed data using ${conceptName}"
    
    def analyze(self):
        """
        Analyze the concept implementation
        """
        return {
            "concept": "${conceptName}",
            "status": "implemented",
            "ready": True
        }

# Example usage
if __name__ == "__main__":
    concept = ${conceptName.replace(/\s+/g, '')}()
    result = concept.process("sample_data")
    analysis = concept.analyze()
    print(f"Result: {result}")
    print(f"Analysis: {analysis}")
`
      }
      
      setGeneratedCodes(prev => [...prev, mockCode])
    } catch (err) {
      console.error('Failed to generate code:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!paperId) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-sm">
              Upload a paper to see generated code
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
              Code generation will be available after analysis completes
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
              Code generation requires extracted concepts
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (generatedCodes.length === 0) {
    // Show generating state if code is being generated
    if (loading && codeGeneratingFor) {
      return (
        <LoadingCard
          title="🔄 Generating code implementation..."
          message={generatingStep}
          showSpinner={false}
        >
          <div className="mt-4 w-full max-w-xs">
            <LoadingProgress
              progress={generatingProgress}
              message={generatingStep}
            />
          </div>
        </LoadingCard>
      )
    }
    
    return (
      <div className="space-y-4">
        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="text-center text-slate-500">
            <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💻</span>
            </div>
            <p className="text-sm">
              Click "Code" to generate implementation examples
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {generatedCodes.map((codeItem, index) => (
        <div key={`${codeItem.conceptId}-${index}`} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{codeItem.conceptName}</h4>
                <p className="text-sm text-slate-600">{codeItem.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full">
                  {codeItem.language}
                </span>
                <Button
                  onClick={() => {
                    setGeneratedCodes(prev => prev.filter((_, i) => i !== index))
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Code Block */}
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto text-sm">
              <code>{codeItem.code}</code>
            </pre>
            
            {/* Copy Button */}
            <Button
              onClick={() => navigator.clipboard.writeText(codeItem.code)}
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 bg-white/90 hover:bg-white"
            >
              📋 Copy
            </Button>
          </div>
        </div>
      ))}
      
      {loading && generatedCodes.length > 0 && (
        <LoadingCard
          title="🔄 Generating additional code..."
          message={generatingStep}
          showSpinner={false}
        >
          <div className="mt-4 w-full max-w-xs">
            <LoadingProgress
              progress={generatingProgress}
              message={generatingStep}
            />
          </div>
        </LoadingCard>
      )}
    </div>
  )
}

// Export the code generation function for use in parent component
export { type CodeImplementationProps }