import { NextRequest, NextResponse } from 'next/server'

interface LlamaRequest {
  type: 'process_pdf' | 'query'
  pdfContent?: string
  question?: string
  context?: string
}

interface LlamaResponse {
  success: boolean
  data?: any
  error?: string
}

// Function to strip out <think> tags and their content
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// Function to convert markdown to HTML
function markdownToHtml(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    
    // Wrap in paragraphs if not already wrapped
    .replace(/^(?!<[h|p|ul|ol|pre]).*$/gim, '<p>$&</p>')
    
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br><\/p>/g, '')
    
    // Wrap lists properly
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    
    // Clean up multiple line breaks
    .replace(/<br><br>/g, '</p><p>')
    
    // Final cleanup
    .replace(/<p><\/p>/g, '')
    .trim()
}

// Real Llama 3.3 Nemotron Super 49B API integration with NVIDIA API
class LlamaNemotronAPI {
  private modelEndpoint: string
  private apiKey: string
  private modelName: string

  constructor() {
    this.modelEndpoint = process.env.LLAMA_ENDPOINT || 'https://integrate.api.nvidia.com/v1'
    this.apiKey = process.env.LLAMA_API_KEY || ''
    this.modelName = process.env.MODEL_NAME || 'nvidia/llama-3.3-nemotron-super-49b-v1.5'
  }

  async makeAPICall(prompt: string, maxTokens: number = 4096): Promise<string> {
    try {
      const response = await fetch(`${this.modelEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.6'),
          top_p: parseFloat(process.env.MODEL_TOP_P || '0.95'),
          frequency_penalty: parseFloat(process.env.MODEL_FREQUENCY_PENALTY || '0'),
          presence_penalty: parseFloat(process.env.MODEL_PRESENCE_PENALTY || '0'),
          seed: parseInt(process.env.MODEL_SEED || '0', 10),
          stream: false
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API call failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const rawResponse = data.choices[0]?.message?.content || 'No response from model'
      
      // Strip out <think> tags and convert markdown to HTML
      const cleanResponse = stripThinkTags(rawResponse)
      return markdownToHtml(cleanResponse)
    } catch (error) {
      console.error('API call error:', error)
      throw error
    }
  }

  async processPDF(pdfContent: string): Promise<string> {
    try {
      const prompt = `Please analyze the following research paper content and extract key concepts, findings, and important information. Provide a comprehensive analysis that can be used for Q&A.

IMPORTANT: Provide only the final analysis. Do not include your thinking process, reasoning steps, or internal deliberations in the output.

${pdfContent.substring(0, 4000)}

Please provide a structured analysis including:
1. Key research questions and objectives
2. Methodology and approach
3. Main findings and results
4. Conclusions and implications
5. Important figures, tables, or data points

Format your response in a way that will be useful for answering specific questions about this research paper.`

      return await this.makeAPICall(prompt, 2048)
    } catch (error) {
      throw new Error(`Failed to process PDF: ${error}`)
    }
  }

  async queryModel(question: string, context: string): Promise<string> {
    try {
      const prompt = `Based on the following research paper context, please answer this question comprehensively and accurately.

IMPORTANT: Provide only the final answer. Do not include your thinking process, reasoning steps, or internal deliberations in the output.

Context: ${context}

Question: ${question}

Please provide a detailed answer that:
1. References specific parts of the research paper
2. Explains the methodology, results, or conclusions as relevant
3. Provides clear, understandable explanations
4. Cites specific findings or data when applicable

Answer:`

      return await this.makeAPICall(prompt, 2048)
    } catch (error) {
      throw new Error(`Failed to query model: ${error}`)
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<LlamaResponse>> {
  try {
    const body: LlamaRequest = await request.json()
    const llamaAPI = new LlamaNemotronAPI()

    // Validate API key is set
    if (!process.env.LLAMA_API_KEY) {
      console.error('LLAMA_API_KEY environment variable is not set')
      return NextResponse.json({
        success: false,
        error: 'API key not configured'
      }, { status: 500 })
    }

    if (body.type === 'process_pdf' && body.pdfContent) {
      console.log('Processing PDF with content length:', body.pdfContent.length)
      const processedContent = await llamaAPI.processPDF(body.pdfContent)
      return NextResponse.json({
        success: true,
        data: {
          processedContent,
          message: 'PDF processed successfully with Llama 3.3 Nemotron Super 49B'
        }
      })
    }

    if (body.type === 'query' && body.question && body.context) {
      console.log('Querying model with question:', body.question.substring(0, 100) + '...')
      const answer = await llamaAPI.queryModel(body.question, body.context)
      return NextResponse.json({
        success: true,
        data: {
          answer,
          model: 'Llama 3.3 Nemotron Super 49B'
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request type or missing parameters'
    }, { status: 400 })

  } catch (error) {
    console.error('Llama API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
} 