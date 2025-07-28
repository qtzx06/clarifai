"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check } from "lucide-react"

// Mock data for demonstration
const mockImplementations = [
  {
    id: "transformer",
    name: "Transformer Architecture",
    languages: ["python", "javascript", "pytorch"],
  },
  {
    id: "self-attention",
    name: "Self-Attention Mechanism",
    languages: ["python", "pytorch"],
  },
  {
    id: "multi-head",
    name: "Multi-Head Attention",
    languages: ["python", "pytorch"],
  },
]

const mockCode = {
  python: `import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_size, heads):
        super(SelfAttention, self).__init__()
        self.embed_size = embed_size
        self.heads = heads
        self.head_dim = embed_size // heads
        
        assert (self.head_dim * heads == embed_size), "Embed size needs to be divisible by heads"
        
        self.values = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.keys = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.queries = nn.Linear(self.head_dim, self.head_dim, bias=False)
        self.fc_out = nn.Linear(heads * self.head_dim, embed_size)
        
    def forward(self, values, keys, query, mask):
        # Get batch size
        N = query.shape[0]
        value_len, key_len, query_len = values.shape[1], keys.shape[1], query.shape[1]
        
        # Split embedding into self.heads pieces
        values = values.reshape(N, value_len, self.heads, self.head_dim)
        keys = keys.reshape(N, key_len, self.heads, self.head_dim)
        queries = query.reshape(N, query_len, self.heads, self.head_dim)
        
        # Implementation continues...
        return out`,

  pytorch: `class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super(MultiHeadAttention, self).__init__()
        assert d_model % num_heads == 0
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        self.W_o = nn.Linear(d_model, d_model)
        
    def scaled_dot_product_attention(self, Q, K, V, mask=None):
        attn_scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        
        if mask is not None:
            attn_scores = attn_scores.masked_fill(mask == 0, -1e9)
            
        attn_probs = torch.softmax(attn_scores, dim=-1)
        output = torch.matmul(attn_probs, V)
        
        return output
        
    def forward(self, Q, K, V, mask=None):
        batch_size = Q.size(0)
        
        # Linear projections and split into heads
        q = self.W_q(Q).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        k = self.W_k(K).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        v = self.W_v(V).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        
        # Apply attention
        attn_output = self.scaled_dot_product_attention(q, k, v, mask)
        
        # Reshape and apply final linear layer
        attn_output = attn_output.transpose(1, 2).contiguous().view(batch_size, -1, self.d_model)
        output = self.W_o(attn_output)
        
        return output`,

  javascript: `class TransformerEncoder {
  constructor(embedSize, numHeads, feedForwardDim, dropout = 0.1) {
    this.embedSize = embedSize;
    this.numHeads = numHeads;
    this.feedForwardDim = feedForwardDim;
    this.dropout = dropout;
  }
  
  multiHeadAttention(query, key, value) {
    // Implementation of multi-head attention
    // This is a simplified version for demonstration
    
    const headSize = this.embedSize / this.numHeads;
    
    // Split into multiple heads
    const splitHeads = (tensor) => {
      // Reshape tensor for multi-head attention
      // In a real implementation, this would use matrix operations
      return tensor;
    };
    
    // Calculate attention scores
    const calculateAttention = (q, k, v) => {
      // Compute scaled dot-product attention
      // In a real implementation, this would use matrix operations
      return v;
    };
    
    // Process each head
    const heads = [];
    for (let i = 0; i < this.numHeads; i++) {
      const q = splitHeads(query);
      const k = splitHeads(key);
      const v = splitHeads(value);
      
      heads.push(calculateAttention(q, k, v));
    }
    
    // Concatenate heads and project
    return heads.flat();
  }
  
  feedForward(x) {
    // Feed-forward network
    // In a real implementation, this would use matrix operations
    return x;
  }
  
  encode(input) {
    // Self-attention
    const attention = this.multiHeadAttention(input, input, input);
    
    // Add & Norm
    const normalized1 = attention + input;
    
    // Feed-forward
    const ff = this.feedForward(normalized1);
    
    // Add & Norm
    const output = ff + normalized1;
    
    return output;
  }
}`,
}

export function CodeImplementation() {
  const [selectedConcept, setSelectedConcept] = useState(mockImplementations[0].id)
  const [selectedLanguage, setSelectedLanguage] = useState("python")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mockCode[selectedLanguage as keyof typeof mockCode])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const concept = mockImplementations.find((c) => c.id === selectedConcept)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Select Concept</label>
          <Select value={selectedConcept} onValueChange={setSelectedConcept}>
            <SelectTrigger>
              <SelectValue placeholder="Select concept" />
            </SelectTrigger>
            <SelectContent>
              {mockImplementations.map((concept) => (
                <SelectItem key={concept.id} value={concept.id}>
                  {concept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Programming Language</label>
          <Select
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
            disabled={!concept?.languages.includes(selectedLanguage)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {concept?.languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative">
        <div className="absolute right-2 top-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={copyToClipboard}
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <pre className="p-4 rounded-lg bg-muted overflow-x-auto text-sm">
          <code>{mockCode[selectedLanguage as keyof typeof mockCode]}</code>
        </pre>
      </div>

      <div className="flex justify-end">
        <Button>Generate Alternative Implementation</Button>
      </div>
    </div>
  )
}
