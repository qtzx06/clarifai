import React from 'react'
import { ConceptList } from '../concept-list'
import { FileUploader } from '../file-uploader'
import { QuestionSection } from '../question-section'
import { VideoExplanation } from '../video-explanation'
import { CodeImplementation } from '../code-implementation'

export default function Home() {
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
            <FileUploader />
          </div>
        </section>

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Concepts & Chat */}
          <div className="xl:col-span-2 space-y-8">
            {/* Key Concepts Section */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <span className="text-amber-600 text-lg">💡</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Key Concepts
                </h3>
                <div className="ml-auto">
                  <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    3 concepts extracted
                  </span>
                </div>
              </div>
              <ConceptList />
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
              <QuestionSection />
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
              <VideoExplanation />
            </section>

            {/* Code Implementation */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-lg">💻</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Code Implementation
                </h3>
              </div>
              <CodeImplementation />
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 mt-16">
        <div className="container mx-auto px-6 py-6">
          <div className="text-center text-sm text-slate-600">
            <p>Powered by Clarifai AI • Research Paper Analysis Tool</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 