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

const getHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Try to get Supabase auth token first
  if (typeof window !== 'undefined') {
    try {
      const { getSessionToken } = await import('./supabase');
      const token = await getSessionToken();
      console.log('[API] getHeaders: token retrieved:', token ? `${token.substring(0, 20)}...` : 'null');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[API] getHeaders: Authorization header set');
      } else {
        console.log('[API] getHeaders: No token available');
      }
    } catch (error) {
      // Supabase not available, fall back to API key
      console.error('[API] getHeaders: Error getting token:', error);
      console.debug('Supabase auth not available, using API key if configured');
    }
  }
  
  // Fallback to API key if no auth token
  if (API_KEY && !headers['Authorization']) {
    headers['X-API-Key'] = API_KEY;
    console.log('[API] getHeaders: Using API key fallback');
  }
  
  console.log('[API] getHeaders: Final headers:', Object.keys(headers), 'Has Auth:', !!headers['Authorization']);
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

export interface UsageStats {
  daily_limit: number;
  today_count: number;
  remaining_today: number;
  currently_generating: number;
  max_concurrent: number;
}

// Paper API
export async function uploadPaper(file: File): Promise<Paper> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const headers = await getHeaders();
    // Remove Content-Type for FormData - browser will set it with boundary
    delete (headers as any)['Content-Type'];
    
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers,
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
  const headers = await getHeaders();
  console.log('[API] listPapers: Making request with headers:', Object.keys(headers));
  const response = await fetch(`${API_URL}/api/papers`, {
    headers,
  });

  console.log('[API] listPapers: Response status:', response.status);
  if (!response.ok) {
    throw new Error('Failed to fetch papers');
  }

  const data = await response.json();
  return data.papers || [];
}

export async function getPaper(paperId: string): Promise<Paper> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/papers/${paperId}/status`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch paper');
  }

  return response.json();
}

export async function deletePaper(paperId: string): Promise<void> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/papers/${paperId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Delete failed:', response.status, errorText);
    throw new Error(`Failed to delete paper: ${response.status} ${errorText}`);
  }
}

export async function analyzePaper(paperId: string): Promise<void> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/papers/${paperId}/analyze`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to analyze paper');
  }
}

export async function getConcepts(paperId: string): Promise<Concept[]> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/papers/${paperId}/concepts`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch concepts');
  }

  const data = await response.json();
  return data.concepts || [];
}

export async function generateAdditionalConcept(paperId: string): Promise<Concept> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/papers/${paperId}/generate-additional-concept`, {
    method: 'POST',
    headers,
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
      headers: await getHeaders(),
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
  const headers = await getHeaders();
  const response = await fetch(
    `${API_URL}/api/papers/${paperId}/concepts/${conceptId}/video/status`,
    { headers }
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
  const headers = await getHeaders();
  const response = await fetch(
    `${API_URL}/api/papers/${paperId}/concepts/${encodeURIComponent(conceptName)}/implement`,
    { 
      method: 'POST',
      headers,
    }
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
    headers: await getHeaders(),
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

// Usage stats API
export async function getUsageStats(): Promise<UsageStats> {
  const headers = await getHeaders();
  const response = await fetch(`${API_URL}/api/usage-stats`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch usage stats: ${response.statusText}`);
  }

  return response.json();
}

// WebSocket for live logs
export function connectToLogs(paperId: string): WebSocket {
  const ws = new WebSocket(`${WS_URL}/ws/papers/${paperId}/logs`);
  return ws;
}
