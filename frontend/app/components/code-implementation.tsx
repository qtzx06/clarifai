"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Copy } from "lucide-react"
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
      setGeneratedCodes([])
      setAnalysisStatus('pending')
      setLoading(false)
      
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
      setGeneratedCodes([])
      setAnalysisStatus('pending')
      setLoading(false)
    }
  }, [paperId])

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
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/concepts/${conceptId}/implement`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const newCode: GeneratedCode = {
          conceptId,
          conceptName,
          language: data.language,
          description: data.description,
          code: data.code,
        };
        setGeneratedCodes(prev => [...prev, newCode]);
      } else {
        console.error("Failed to generate code");
      }
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

  if (generatedCodes.length === 0) {
    if (loading && codeGeneratingFor) {
      return (
        <LoadingCard
          title="🔄 Generating code implementation..."
          message={generatingStep}
          showSpinner={true}
        />
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
        <div key={`${codeItem.conceptId}-${index}`} className="border border-slate-200 rounded-lg overflow-hidden group">
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
                  className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="relative bg-white p-4 border-t border-slate-200">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-800">
              <code>{codeItem.code}</code>
            </pre>
            <Button
              onClick={() => navigator.clipboard.writeText(codeItem.code)}
              variant="ghost"
              size="sm"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      
      {loading && generatedCodes.length > 0 && (
        <LoadingCard
          title="🔄 Generating additional code..."
          message="Requesting new implementation..."
          showSpinner={true}
        />
      )}
    </div>
  )
}
