"use client"

import React, { useState } from 'react'
import { ConceptList } from './components/concept-list'
import { FileUploader } from './components/file-uploader'
import { QuestionSection } from './components/question-section'
import { VideoExplanation } from './components/video-explanation'
import { CodeImplementation } from './components/code-implementation'

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
  const [analysisTriggered, setAnalysisTriggered] = useState(false)

  const handlePaperUploaded = async (paper: Paper) => {
    setCurrentPaper(paper)
    
    // Automatically trigger analysis after upload
    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paper.id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        setAnalysisTriggered(true)
      }
    } catch (error) {
      console.error('Failed to trigger analysis:', error)
    }
  }

  const handleVideoGeneration = (conceptId: string) => {
    // This will be called when video generation is requested from concept list
    console.log('Video generation requested for concept:', conceptId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Clarifai AI Assistant
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
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-800 mb-3">
                Start Your Analysis
              </h2>
              <p className="text-slate-600 text-lg">
                Upload a research paper to extract key concepts and generate insights
              </p>
            </div>
            <FileUploader onPaperUploaded={handlePaperUploaded} />
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
                <div className="space-y-2">
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
                      Analysis: {currentPaper.analysis_status}
                    </span>
                  </div>
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
                  onGenerateVideo={handleVideoGeneration}
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
                <QuestionSection paperId={currentPaper.id} />
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
                    Video Explanation
                  </h3>
                </div>
                <VideoExplanation paperId={currentPaper.id} />
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
                <CodeImplementation paperId={currentPaper.id} />
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