export interface Citation {
  file_name: string;
  page: number;
  chunk_id?: string;
  relevance_score?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  team: string;
}

export interface ApiErrorResponse {
  status: 'error';
  error_type: string;
  message: string;
  details?: string;
  suggestion?: string;
}
