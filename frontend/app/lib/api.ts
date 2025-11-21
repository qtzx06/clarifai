const resolveApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:8000';
};

const resolveWsUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'ws://localhost:8000';
};

const API_URL = resolveApiUrl();
const WS_URL = resolveWsUrl();

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
};

export interface Paper {
  id: string;
  filename: string;
  title?: string;
  authors?: string[];
  abstract?: string;
  uploaded_at: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'error';
}

export interface VideoCaption {
  clip: number;
  text: string;
  rendered?: boolean;
}

export interface Concept {
  id: string;
  name: string;
  type: string;
  importance_score: number;
  description: string;
  video_status?: 'not_generated' | 'generating' | 'ready' | 'error';
  video_url?: string;
  video_captions?: VideoCaption[];
  code?: string;
}

export interface VideoGenerationStatus {
  status: 'not_started' | 'generating' | 'completed' | 'error';
  message?: string;
  video_url?: string;
}

// Paper API
export async function uploadPaper(file: File): Promise<Paper> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData,
    });

    console.log('Upload response status:', response.status, response.statusText);
    console.log('Upload response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', response.status, errorText);
      throw new Error(`Failed to upload paper: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Upload response data:', data);
    
    // Validate response has required fields
    if (!data.id) {
      console.error('Invalid response: missing id', data);
      throw new Error('Invalid response from server: missing paper id');
    }
    
    return data as Paper;
  } catch (err) {
    console.error('Upload error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to upload paper: Unknown error');
  }
}

export async function listPapers(): Promise<Paper[]> {
  const response = await fetch(`${API_URL}/api/papers`);

  if (!response.ok) {
    throw new Error('Failed to fetch papers');
  }

  const data = await response.json();
  return data.papers || [];
}

export async function getPaper(paperId: string): Promise<Paper> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/status`);

  if (!response.ok) {
    throw new Error('Failed to fetch paper');
  }

  return response.json();
}

export async function deletePaper(paperId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete paper');
  }
}

export async function analyzePaper(paperId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/analyze`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to analyze paper');
  }
}

export async function getConcepts(paperId: string): Promise<Concept[]> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/concepts`);

  if (!response.ok) {
    throw new Error('Failed to fetch concepts');
  }

  const data = await response.json();
  return data.concepts || [];
}

export async function generateAdditionalConcept(paperId: string): Promise<Concept> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/generate-additional-concept`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to generate additional concept');
  }

  return response.json();
}

// Video API
export async function generateVideo(paperId: string, conceptId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/papers/${paperId}/concepts/${conceptId}/generate-video`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to start video generation');
  }
}

export async function getVideoStatus(
  paperId: string,
  conceptId: string
): Promise<VideoGenerationStatus> {
  const response = await fetch(
    `${API_URL}/api/papers/${paperId}/concepts/${conceptId}/video/status`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch video status');
  }

  return response.json();
}

// Code Implementation API
export async function getCodeImplementation(
  paperId: string,
  conceptName: string
): Promise<{ code: string }> {
  const response = await fetch(
    `${API_URL}/api/papers/${paperId}/concepts/${encodeURIComponent(conceptName)}/implement`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error('Failed to generate code');
  }

  return response.json();
}

// Q&A API
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askQuestion(
  paperId: string,
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<{ answer: string }> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/clarify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      question,
      conversation_history: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get answer');
  }

  return response.json();
}

// WebSocket for live logs
export function connectToLogs(paperId: string): WebSocket {
  const ws = new WebSocket(`${WS_URL}/ws/papers/${paperId}/logs`);
  return ws;
}
