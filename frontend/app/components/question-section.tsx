"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface QuestionSectionProps {
  paperId?: string
  externalQuestion?: string
  onExternalQuestionProcessed?: () => void
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function QuestionSection({ paperId, externalQuestion, onExternalQuestionProcessed }: QuestionSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string>('pending')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paperId) {
      // Reset state for new paper
      setMessages([])
      setCurrentQuestion('')
      setLoading(false)
      setAnalysisStatus('pending')
      
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
      const interval = setInterval(checkStatus, 5000)
      return () => clearInterval(interval)
    } else {
      // Reset when no paper
      setMessages([])
      setCurrentQuestion('')
      setLoading(false)
      setAnalysisStatus('pending')
    }
  }, [paperId])

  // Handle external questions from concept clarification
  useEffect(() => {
    if (externalQuestion && paperId && analysisStatus === 'completed' && !loading) {
      console.log('Processing external question:', externalQuestion)
      
      // Auto-send the question directly without setting current question
      const autoSendQuestion = async () => {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'user',
          content: externalQuestion.trim(),
          timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setLoading(true)

        try {
          const response = await fetch(`http://localhost:8000/api/papers/${paperId}/clarify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text_snippet: externalQuestion,
              context: "User question about the research paper"
            })
          })

          if (response.ok) {
            const data = await response.json()
            const assistantMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              type: 'assistant',
              content: data.explanation,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, assistantMessage])
          } else {
            throw new Error('Failed to get response')
          }
        } catch (err) {
          console.error('Failed to ask auto question:', err)
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: 'Sorry, I encountered an error while processing your question. Please try again.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        } finally {
          setLoading(false)
          onExternalQuestionProcessed?.()
        }
      }

      autoSendQuestion()
    }
  }, [externalQuestion, paperId, analysisStatus, loading])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const askQuestion = async () => {
    if (!currentQuestion.trim() || !paperId || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentQuestion.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentQuestion('')
    setLoading(true)

    try {
      const response = await fetch(`http://localhost:8000/api/papers/${paperId}/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text_snippet: userMessage.content,
          context: "User question about the research paper"
        })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.explanation,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('Failed to get response')
      }
    } catch (err) {
      console.error('Failed to ask question:', err)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      askQuestion()
    }
  }

  const suggestedQuestions = [
    "What is the main contribution of this paper?",
    "Can you explain the methodology used?",
    "What are the key findings and results?",
    "How does this work compare to existing approaches?",
    "What are the limitations of this study?"
  ]

  if (!paperId) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="text-4xl mb-4">💬</div>
        <p>Upload a paper to start asking questions</p>
      </div>
    )
  }

  if (analysisStatus !== 'completed') {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-2 text-slate-600 mb-4">
          {analysisStatus === 'processing' && (
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
          )}
          <span>
            {analysisStatus === 'processing'
              ? 'Analyzing paper...'
              : 'Waiting for analysis to complete'
            }
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Q&A will be available after paper analysis
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chat Messages */}
      <div className="border border-slate-200 rounded-lg bg-slate-50 min-h-[300px] max-h-[400px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">📖</span>
            </div>
            <p className="text-slate-600 mb-4">Ask me anything about this research paper!</p>
            
            {/* Suggested Questions */}
            <div className="space-y-2">
              <p className="text-sm text-slate-500 mb-2">Try asking:</p>
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  onClick={() => setCurrentQuestion(question)}
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-slate-600' : 'text-slate-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-600">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <Input
          value={currentQuestion}
          onChange={(e) => setCurrentQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about this paper..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={askQuestion}
          disabled={!currentQuestion.trim() || loading}
          className="px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
        >
          {loading ? '⏳' : 'Ask'}
        </Button>
      </div>

      {/* Info */}
      <div className="text-xs text-slate-500 text-center">
        Ask questions about concepts, methodology, results, or implications
      </div>
    </div>
  )
}