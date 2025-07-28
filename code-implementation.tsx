"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check } from "lucide-react"

export function CodeImplementation() {
  const [selectedConcept, setSelectedConcept] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExample)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const codeExample = `import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_size, heads):
        super(SelfAttention, self).__init__()
        self.embed_size = embed_size
        self.heads = heads
        self.head_dim = embed_size // heads
        
        assert (self.head_dim * heads == embed_size), "Embedding size needs to be divisible by heads"
        
        self.values = nn.Linear(embed_size, embed_size)
        self.keys = nn.Linear(embed_size, embed_size)
        self.queries = nn.Linear(embed_size, embed_size)
        self.fc_out = nn.Linear(embed_size, embed_size)
        
    def forward(self, values, keys, query, mask):
        N = query.shape[0]
        value_len, key_len, query_len = values.shape[1], keys.shape[1], query.shape[1]
        
        # Split the embedding into self.heads different pieces
        values = self.values(values).reshape(N, value_len, self.heads, self.head_dim)
        keys = self.keys(keys).reshape(N, key_len, self.heads, self.head_dim)
        queries = self.queries(query).reshape(N, query_len, self.heads, self.head_dim)
        
        # Einsum does matrix multiplication for query*keys for each training example
        # with every other training example, don't be confused by einsum
        # it's just how I like doing matrix multiplication & bmm
        
        energy = torch.einsum("nqhd,nkhd->nqhk", [queries, keys])
        # queries shape: (N, query_len, heads, heads_dim),
        # keys shape: (N, key_len, heads, heads_dim)
        # energy: (N, query_len, key_len, heads)
        
        if mask is not None:
            energy = energy.masked_fill(mask == 0, float("-1e20"))
        
        attention = torch.softmax(energy / (self.embed_size ** (1/2)), dim=3)
        # attention shape: (N, query_len, key_len, heads)
        
        out = torch.einsum("nqhk,nvhd->nqhd", [attention, values]).reshape(
            N, query_len, self.heads * self.head_dim
        )
        # attention shape: (N, query_len, key_len, heads)
        # values shape: (N, value_len, heads, heads_dim)
        # out shape: (N, query_len, heads, head_dim)
        
        out = self.fc_out(out)
        # Linear layer doesn't modify the shape, final shape will be
        # (N, query_len, embed_size)
        
        return out`

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block text-slate-700">
            Select Concept
          </label>
          <Select value={selectedConcept} onValueChange={setSelectedConcept}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a concept..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transformer">Transformer Architecture</SelectItem>
              <SelectItem value="attention">Self-Attention Mechanism</SelectItem>
              <SelectItem value="multihead">Multi-Head Attention</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block text-slate-700">
            Programming Language
          </label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Choose language..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="java">Java</SelectItem>
              <SelectItem value="cpp">C++</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Code Display */}
      <div className="relative">
        <div className="absolute right-2 top-2 z-10">
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-sm leading-relaxed">
          <code className="language-python">{codeExample}</code>
        </pre>
      </div>

      {/* Code Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-slate-800">Self-Attention Implementation</h4>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
            Python • PyTorch
          </span>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          This implementation shows the core self-attention mechanism used in transformer models. 
          It includes the query, key, value projections and the attention computation with proper masking support.
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Lines: 45</span>
          <span>•</span>
          <span>Complexity: O(n²)</span>
          <span>•</span>
          <span>Memory: O(n²)</span>
        </div>
      </div>
    </div>
  )
} 