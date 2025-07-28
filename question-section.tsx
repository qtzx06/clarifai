"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { SendHorizontal, Bot, User } from "lucide-react"

// Mock chat data
const mockMessages = [
  {
    id: 1,
    type: "user" as const,
    content: "Can you explain how the self-attention mechanism works in simpler terms?",
    timestamp: "2 minutes ago",
  },
  {
    id: 2,
    type: "ai" as const,
    content: "Think of self-attention like a student reading a book and highlighting important parts. When the student reads the word 'it', they need to figure out what 'it' refers to by looking at other words in the text.\n\nSimilarly, self-attention allows each word in a sentence to 'look at' all other words to determine which ones are most relevant to its meaning. It assigns 'attention weights' to show how much each word should focus on every other word.\n\nFor example, in 'The cat sat on the mat because it was comfortable', self-attention helps the model understand that 'it' refers to 'the mat' by creating stronger connections between these words.",
    timestamp: "1 minute ago",
  },
]

export function QuestionSection() {
  const [messages, setMessages] = useState(mockMessages)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const newMessage = {
      id: messages.length + 1,
      type: "user" as const,
      content: inputValue,
      timestamp: "Just now",
    }

    setMessages([...messages, newMessage])
    setInputValue("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        id: messages.length + 2,
        type: "ai" as const,
        content: "I'm analyzing your question about the research paper. This is a simulated response that would contain relevant information based on the uploaded document.",
        timestamp: "Just now",
      }
      setMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === "user" ? "justify-end" : ""}`}
          >
            {message.type === "ai" && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
            
            <div
              className={`rounded-lg shadow-sm max-w-[80%] ${
                message.type === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className={`text-xs mt-1 ${
                  message.type === "user" 
                    ? "text-blue-100" 
                    : "text-slate-500"
                }`}>
                  {message.timestamp}
                </div>
              </div>
            </div>

            {message.type === "user" && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-slate-100 text-slate-600">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-w-[80%]">
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                  <span className="text-sm text-slate-500">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question about the paper..."
          className="min-h-[60px] resize-none"
          disabled={isLoading}
        />
        <Button 
          type="submit" 
          disabled={!inputValue.trim() || isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
} 