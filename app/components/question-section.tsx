"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SendHorizontal, Bot, User, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Dynamic import to avoid SSR issues
const parsePDF = async (file: File) => {
  const { parsePDF: parsePDFFunction } = await import('@/lib/pdf-parser')
  return parsePDFFunction(file)
}

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface PDFContext {
  text: string
  pages: number
  filename: string
  processed: boolean
}

export function QuestionSection() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newQuestion, setNewQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [pdfContext, setPdfContext] = useState<PDFContext | null>(null)
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Initialize model connection
  useEffect(() => {
    initializeModel()
  }, [])

  const initializeModel = async () => {
    setModelStatus("loading")
    try {
      // Test the connection to Llama 3.3 Nemotron Super 49B
      const response = await fetch('/api/llama', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'query',
          question: 'Test connection',
          context: 'This is a test to verify the Llama model connection.'
        })
      })

      if (response.ok) {
        setModelStatus("ready")
      } else {
        throw new Error('Model connection failed')
      }
    } catch (error) {
      console.error("Failed to initialize model:", error)
      setModelStatus("error")
    }
  }

  const processPDF = async (file: File) => {
    setIsProcessingPdf(true)
    try {
      console.log('Starting PDF processing for file:', file.name, 'Size:', file.size)
      
      // Parse PDF content using our utility
      const pdfContent = await parsePDF(file)
      console.log('PDF parsed successfully. Pages:', pdfContent.pages, 'Text length:', pdfContent.text.length)
      
      // Call our Llama API to process the PDF
      const response = await fetch('/api/llama', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'process_pdf',
          pdfContent: pdfContent.text
        })
      })

      console.log('API response status:', response.status)
      const result = await response.json()
      console.log('API response result:', result)

      if (result.success) {
        setPdfContext({
          text: result.data.processedContent,
          pages: pdfContent.pages,
          filename: file.name,
          processed: true
        })

        // Add system message about PDF processing
        setMessages([{
          id: 1,
          role: "assistant",
          content: `PDF "${file.name}" has been processed successfully with Llama 3.3 Nemotron Super 49B! I've analyzed ${pdfContent.pages} pages and extracted key concepts. You can now ask me detailed questions about the research paper, and I'll provide comprehensive answers based on the full document context.`,
          timestamp: "Just now"
        }])
      } else {
        console.error('API returned error:', result.error)
        throw new Error(result.error || 'Failed to process PDF')
      }

    } catch (error) {
      console.error("Failed to process PDF:", error)
      setMessages([{
        id: 1,
        role: "assistant",
        content: `Sorry, I encountered an error while processing the PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please try uploading it again.`,
        timestamp: "Just now"
      }])
    } finally {
      setIsProcessingPdf(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "application/pdf") {
      processPDF(file)
    }
  }

  const queryLlamaModel = async (question: string, context: string) => {
    try {
      console.log('Querying model with question:', question.substring(0, 100) + '...')
      
      const response = await fetch('/api/llama', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'query',
          question,
          context
        })
      })

      console.log('Query API response status:', response.status)
      const result = await response.json()
      console.log('Query API response result:', result)

      if (result.success) {
        return result.data.answer
      } else {
        console.error('Query API returned error:', result.error)
        throw new Error(result.error || 'Failed to get response from Llama model')
      }
    } catch (error) {
      console.error('Failed to query Llama model:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !pdfContext?.processed) return

    const userMessage: Message = {
      id: messages.length + 1,
      role: "user",
      content: newQuestion,
      timestamp: "Just now",
    }

    setMessages(prev => [...prev, userMessage])
    setNewQuestion("")
    setIsLoading(true)

    try {
      const response = await queryLlamaModel(newQuestion, pdfContext.text)
      
      const aiMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: response,
        timestamp: "Just now",
      }
      
      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error("Failed to get response:", error)
      const errorMessage: Message = {
        id: messages.length + 2,
        role: "assistant",
        content: "I apologize, but I encountered an error while processing your question. Please try again.",
        timestamp: "Just now",
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header with Model Status */}
      <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">PDF Q&A with Llama 3.3 Nemotron</span>
        </div>
        <div className="flex items-center gap-2">
          {modelStatus === "ready" && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Model Ready
            </Badge>
          )}
          {modelStatus === "loading" && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent" />
              Loading Model
            </Badge>
          )}
          {modelStatus === "error" && (
            <Badge variant="secondary" className="bg-red-100 text-red-700">
              <AlertCircle className="h-3 w-3 mr-1" />
              Model Error
            </Badge>
          )}
        </div>
      </div>

      {/* PDF Upload Section */}
      {!pdfContext?.processed && (
        <div className="mb-4 p-4 border-2 border-dashed border-slate-300 rounded-lg text-center">
          <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <h3 className="font-medium text-slate-700 mb-1">Upload Research Paper</h3>
          <p className="text-sm text-slate-500 mb-3">
            Upload a PDF to enable Q&A with Llama 3.3 Nemotron Super 49B
          </p>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="pdf-upload"
            disabled={isProcessingPdf}
          />
          <label
            htmlFor="pdf-upload"
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${
              isProcessingPdf
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isProcessingPdf ? "Processing..." : "Choose PDF"}
          </label>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4">
        {messages.length === 0 && pdfContext?.processed ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div className="space-y-2">
              <Bot className="h-12 w-12 mx-auto text-blue-600" />
              <h3 className="font-medium text-lg">Ask questions about the paper</h3>
              <p className="text-muted-foreground text-sm">
                The Llama 3.3 Nemotron Super 49B model has analyzed your PDF and is ready to answer questions
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <Card className={`max-w-[80%] ${message.role === "user" ? "bg-blue-600 text-white" : ""}`}>
                <CardContent className="p-3 text-sm">
                  <div 
                    className={`${message.role === "user" ? "text-white" : ""}`}
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                  <div 
                    className={`text-xs mt-1 ${
                      message.role === "user" ? "text-blue-100" : "text-muted-foreground"
                    }`}
                  >
                    {message.timestamp}
                  </div>
                </CardContent>
              </Card>

              {message.role === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-slate-100 text-slate-600">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                  <span className="text-sm text-slate-500">Llama 3.3 Nemotron is thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder={pdfContext?.processed ? "Ask a question about the paper..." : "Upload a PDF first to enable Q&A"}
          className="min-h-[60px] resize-none"
          disabled={!pdfContext?.processed || isLoading}
        />
        <Button 
          type="submit" 
          disabled={!newQuestion.trim() || !pdfContext?.processed || isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
      
      <div ref={messagesEndRef} />
    </div>
  )
}
