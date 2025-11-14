const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface Paper {
  id: string;
  filename: string;
  title?: string;
  authors?: string[];
  abstract?: string;
  uploaded_at: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'error';
}

export interface Concept {
  id: string;
  name: string;
  type: string;
  importance_score: number;
  description: string;
  video_status?: 'not_generated' | 'generating' | 'ready' | 'error';
  video_url?: string;
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

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload paper');
  }

  return response.json();
}

export async function getPaper(paperId: string): Promise<Paper> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/status`);

  if (!response.ok) {
    throw new Error('Failed to fetch paper');
  }

  return response.json();
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
    { method: 'POST' }
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
export async function askQuestion(
  paperId: string,
  question: string
): Promise<{ answer: string }> {
  const response = await fetch(`${API_URL}/api/papers/${paperId}/clarify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
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
