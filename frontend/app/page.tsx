"use client"

import React, { useState, useEffect } from 'react'
import { ConceptList } from './components/concept-list'
import { FileUploader } from './components/file-uploader'
import { QuestionSection } from './components/question-section'
import { VideoExplanation } from './components/video-explanation'
import { CodeImplementation } from './components/code-implementation'
import { PDFViewer } from './components/pdf-viewer'
import { ChevronDown } from 'lucide-react'

interface Paper {
  id: string
  title: string
  authors: string[]
  abstract: string
  analysis_status: string
  video_status?: string
}

export default function Home() {
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null)
  const [concepts, setConcepts] = useState<any[]>([])
  const [codeGenerationRequest, setCodeGenerationRequest] = useState<{conceptId: string, conceptName: string} | null>(null)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [codeGeneratingFor, setCodeGeneratingFor] = useState<string | null>(null)
  const [videoGenerationRequest, setVideoGenerationRequest] = useState<{conceptId: string, conceptName: string} | null>(null)
  const [videoGeneratingFor, setVideoGeneratingFor] = useState<string | null>(null)
  const [questionGeneratingFor, setQuestionGeneratingFor] = useState<string | null>(null)
  const [clarifyQuestion, setClarifyQuestion] = useState<string | null>(null)

  // Listen for video generation completion
  useEffect(() => {
    const handleVideoComplete = (event: CustomEvent) => {
      const { conceptId } = event.detail
      if (videoGeneratingFor === conceptId) {
        setVideoGeneratingFor(null)
      }
    }

    window.addEventListener('videoGenerationComplete', handleVideoComplete as EventListener)
    
    return () => {
      window.removeEventListener('videoGenerationComplete', handleVideoComplete as EventListener)
    }
  }, [videoGeneratingFor])

  const handlePaperUploaded = async (paper: Paper) => {
    // Reset state for new paper and immediately set status to processing
    setCurrentPaper({ ...paper, analysis_status: 'processing' });
    setConcepts([]);
    setCodeGenerationRequest(null);
    setShowPdfViewer(false);
    setCodeGeneratingFor(null);
    setVideoGeneratingFor(null);
    setQuestionGeneratingFor(null);
    setClarifyQuestion(null);

    // 1. Trigger analysis on the backend
    try {
      const analyzeResponse = await fetch(`http://localhost:8000/api/papers/${paper.id}/analyze`, {
        method: 'POST',
      });
      if (!analyzeResponse.ok) {
        console.error('Failed to start analysis');
        return; // Stop if analysis fails to start
      }
      // Immediately update status on the frontend to show loading
      setCurrentPaper(prev => prev ? { ...prev, analysis_status: 'processing' } : null);
    } catch (error) {
      console.error('Error triggering analysis:', error);
      return;
    }

    // 2. Poll for analysis completion
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`http://localhost:8000/api/papers/${paper.id}/status`);
        if (!statusResponse.ok) {
          // Stop polling if the status endpoint fails
          clearInterval(pollInterval);
          return;
        }
        
        const statusData = await statusResponse.json();
        
        // Update paper status in UI to show "processing"
        setCurrentPaper(prev => prev ? { ...prev, analysis_status: statusData.analysis_status } : null);

        // 3. Fetch concepts when analysis is complete
        if (statusData.analysis_status === 'completed') {
          clearInterval(pollInterval); // Stop polling
          const conceptsResponse = await fetch(`http://localhost:8000/api/papers/${paper.id}/concepts`);
          if (conceptsResponse.ok) {
            const conceptsData = await conceptsResponse.json();
            setConcepts(conceptsData.concepts || []);
          }
        }
      } catch (error) {
        console.error('Error polling for status:', error);
        clearInterval(pollInterval); // Stop polling on error
      }
    }, 3000); // Poll every 3 seconds
  }

  const handleVideoGeneration = (conceptId: string, conceptName: string) => {
    // This will be called when video generation is requested from concept list
    console.log('Video generation requested for concept:', conceptId, conceptName)
    
    if (!currentPaper) return
    
    // Prevent multiple video generations at once (one at a time)
    if (videoGeneratingFor) {
      console.log('⚠️ Another video is already generating, please wait')
      return
    }
    
    // Set loading state and pass request to video component
    setVideoGeneratingFor(conceptId)
    setVideoGenerationRequest({ conceptId, conceptName })
    
    // video-explanation.tsx will handle the actual backend call and polling
    console.log('✅ Video generation request passed to VideoExplanation component')
  }

  const handleCodeGeneration = (conceptId: string, conceptName: string) => {
    // This will be called when code generation is requested from concept list
    console.log('Code generation requested for concept:', conceptId, conceptName)
    setCodeGeneratingFor(conceptId)
    setCodeGenerationRequest({ conceptId, conceptName })
    
    // Ensure loading state shows for at least 3 seconds
    setTimeout(() => {
      setCodeGeneratingFor(null)
    }, 3000)
  }

  const handleCodeGenerated = () => {
    setCodeGenerationRequest(null)
    // Don't reset codeGeneratingFor here - it's handled by timeout
  }

  const handleVideoGenerated = () => {
    setVideoGenerationRequest(null)
    setVideoGeneratingFor(null) // Reset loading state when video component is done
  }

  const handleClarifyQuestion = (question: string) => {
    console.log('Clarify question received:', question)
    
    // Extract concept ID from question to set loading state
    // For now, we'll use a simple approach - in real implementation, this would be more sophisticated
    const conceptId = question.includes('concept:') ? question.split('concept:')[1]?.trim() : null
    
    if (conceptId) {
      setQuestionGeneratingFor(conceptId)
      
      // Simulate question processing loading
      setTimeout(() => {
        setQuestionGeneratingFor(null)
      }, 3000) // 3 seconds for question processing
    }
    
    setClarifyQuestion(question)
  }

  const handleQuestionProcessed = () => {
    setClarifyQuestion(null)
    // Note: clarifyingFor state is reset by timeout in ConceptList component
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">📖</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ClarifAI
              </h1>
            </div>
            <div className="text-sm text-slate-600">
              Research Paper Analysis Tool
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Upload Section */}
        <section className="mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-white text-4xl">📖</span>
                </div>
                <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  ClarifAI
                </h2>
                <p className="text-slate-600 text-xl max-w-2xl mx-auto leading-relaxed">
                  Transform any research paper into clear insights with agentic AI-powered analysis
                </p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-2xl mx-auto">
                <FileUploader onPaperUploaded={handlePaperUploaded} />
              </div>
            </div>
          </div>
        </section>

        {/* Content Grid - Only show if paper is uploaded */}
        {currentPaper && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left Column - Concepts & Chat */}
            <div className="xl:col-span-2 space-y-8">
              {/* Paper Info Section */}
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">📄</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Paper Details
                  </h3>
                </div>
                
                {/* Paper Metadata */}
                <div className="space-y-2 mb-4">
                  <h4 className="font-medium text-lg text-slate-900">
                    {currentPaper.title}
                  </h4>
                  {currentPaper.authors.length > 0 && (
                    <p className="text-sm text-slate-600">
                      by {currentPaper.authors.join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      currentPaper.analysis_status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : currentPaper.analysis_status === 'processing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      Analysis: {currentPaper.analysis_status.charAt(0).toUpperCase() + currentPaper.analysis_status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* PDF Viewer Toggle */}
                <div className="border-t border-slate-200 pt-4">
                  <button
                    onClick={() => setShowPdfViewer(!showPdfViewer)}
                    className="flex items-center justify-between w-full text-left p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">View PDF</span>
                    </div>
                    <ChevronDown className={`text-slate-500 transition-transform ${showPdfViewer ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Collapsible PDF Viewer */}
                  {showPdfViewer && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <PDFViewer
                        paperId={currentPaper.id}
                        filename={currentPaper.title || 'Research Paper'}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Key Concepts Section */}
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-amber-600 text-lg">💡</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Key Concepts
                  </h3>
                </div>
                <ConceptList
                  paperId={currentPaper.id}
                  concepts={concepts}
                  onUpdateConcepts={setConcepts}
                  onGenerateVideo={handleVideoGeneration}
                  onGenerateCode={handleCodeGeneration}
                  onClarifyQuestion={handleClarifyQuestion}
                  codeGeneratingFor={codeGeneratingFor}
                  videoGeneratingFor={videoGeneratingFor}
                  questionGeneratingFor={questionGeneratingFor}
                  analysisStatus={currentPaper.analysis_status}
                />
              </section>

              {/* Chat Section */}
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">💬</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Ask Questions
                  </h3>
                </div>
                <QuestionSection
                  paperId={currentPaper.id}
                  externalQuestion={clarifyQuestion || undefined}
                  onExternalQuestionProcessed={handleQuestionProcessed}
                />
              </section>
            </div>

            {/* Right Column - Visualizations */}
            <div className="space-y-8">
              {/* Video Explanation */}
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-lg">🎥</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Video Explanation Agent
                  </h3>
                </div>
                <VideoExplanation
                  paperId={currentPaper.id}
                  videoGenerationRequest={videoGenerationRequest}
                  onVideoGenerated={handleVideoGenerated}
                />
              </section>

              {/* Code Implementation */}
              <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-lg">💻</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Generated Code
                  </h3>
                </div>
                <CodeImplementation
                  paperId={currentPaper.id}
                  codeGenerationRequest={codeGenerationRequest}
                  onCodeGenerated={handleCodeGenerated}
                  codeGeneratingFor={codeGeneratingFor}
                />
              </section>
            </div>
          </div>
        )}

        {/* Empty State - Show when no paper is uploaded */}
        {!currentPaper && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">📚</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Ready to Analyze Research Papers
            </h3>
            <p className="text-slate-600 max-w-md mx-auto">
              Upload a PDF research paper above to start extracting key concepts, 
              generating educational videos, and getting AI-powered insights.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 mt-16">
        <div className="container mx-auto px-6 py-6">
          <div className="text-center text-sm text-slate-600">
            <p>Powered by Clarifai AI • Research Paper Analysis Tool</p>
            <p className="mt-1 text-xs">
              Backend API: {currentPaper ? '🟢 Connected' : '🔴 Waiting for upload'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}