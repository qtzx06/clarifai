"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SendHorizontal, Bot } from "lucide-react"

// Mock data for demonstration
const mockMessages = [
  {
    id: 1,
    role: "user",
    content: "Can you explain how the self-attention mechanism works in simpler terms?",
    timestamp: "2 minutes ago",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "Think of self-attention like a student reading a book and highlighting important parts. When the student reads the word 'it', they need to figure out what 'it' refers to by looking at other words in the text.\n\nSimilarly, self-attention allows each word in a sentence to 'look at' all other words to determine which ones are most relevant to its meaning. It assigns 'attention weights' to show how much each word should focus on every other word.\n\nFor example, in 'The cat sat on the mat because it was comfortable', self-attention helps the model understand that 'it' refers to 'the mat' by creating stronger connections between these words.",
    timestamp: "1 minute ago",
  },
]

export function QuestionSection() {
  const [messages, setMessages] = useState(mockMessages)
  const [newQuestion, setNewQuestion] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim()) return

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      role: "user",
      content: newQuestion,
      timestamp: "Just now",
    }

    setMessages([...messages, userMessage])
    setNewQuestion("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage = {
        id: messages.length + 2,
        role: "assistant",
        content:
          "I'm analyzing the paper to answer your question about " +
          newQuestion.substring(0, 30) +
          "... This is a simulated response that would be generated based on the content of the uploaded research paper.",
        timestamp: "Just now",
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-8">
            <div className="space-y-2">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground/60" />
              <h3 className="font-medium text-lg">Ask questions about the paper</h3>
              <p className="text-muted-foreground text-sm">
                Ask specific questions about methods, results, or implications
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Textarea
          placeholder="Ask a question about the paper..."
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          className="min-h-[60px] resize-none"
        />
        <Button type="submit" size="icon" disabled={!newQuestion.trim() || isLoading}>
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
