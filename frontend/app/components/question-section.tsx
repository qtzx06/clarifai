"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SendHorizontal, Bot, AlertCircle } from "lucide-react"

const API_BASE = "http://localhost:8000"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  paper_id?: string
}

interface QuestionSectionProps {
  paperId?: string
}

export function QuestionSection({ paperId }: QuestionSectionProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newQuestion, setNewQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clear messages when paper changes
  useEffect(() => {
    setMessages([])
    setError(null)
  }, [paperId])

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    return date.toLocaleDateString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !paperId) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: newQuestion,
      timestamp: formatTimestamp(new Date()),
      paper_id: paperId
    }

    setMessages(prev => [...prev, userMessage])
    setNewQuestion("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/papers/${paperId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paper_id: paperId,
          message: newQuestion,
          context: "User question from chat interface"
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`)
      }

      const data = await response.json()
      
      // Add AI response
      const aiMessage: Message = {
        id: data.message.id,
        role: "assistant",
        content: data.message.content,
        timestamp: formatTimestamp(new Date(data.message.timestamp)),
        paper_id: paperId
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMsg)
      
      // Add error message to chat
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "I apologize, but I'm having trouble processing your question right now. Please try again in a moment.",
        timestamp: formatTimestamp(new Date()),
        paper_id: paperId
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Connection error: {error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div className="space-y-2">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/60" />
              <h3 className="font-medium text-lg">
                {paperId ? "Ask questions about the paper" : "Upload a paper to start chatting"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {paperId
                  ? "Ask specific questions about methods, results, or implications"
                  : "Once you upload a paper, you can ask questions about its content"
                }
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AI</AvatarFallback>
                  <AvatarImage src="/placeholder.svg?height=40&width=40" />
                </Avatar>
              )}

              <Card className={`max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                <CardContent className="p-3 text-sm">
                  {message.content.split("\n").map((paragraph, i) => (
                    <p key={i} className={i > 0 ? "mt-2" : ""}>
                      {paragraph}
                    </p>
                  ))}
                  <div
                    className={`text-xs mt-1 ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {message.timestamp}
                  </div>
                </CardContent>
              </Card>

              {message.role === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                  <AvatarImage src="/placeholder.svg?height=40&width=40" />
                </Avatar>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>AI</AvatarFallback>
              <AvatarImage src="/placeholder.svg?height=40&width=40" />
            </Avatar>
            <Card>
              <CardContent className="p-3">
                <div className="flex space-x-2 items-center">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse"></div>
                  <div
                    className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  AI is thinking...
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Textarea
          placeholder={paperId ? "Ask a question about the paper..." : "Upload a paper first to enable chat"}
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          className="min-h-[60px] resize-none"
          disabled={!paperId || isLoading}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newQuestion.trim() || isLoading || !paperId}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
