
export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export type Intent = 'CANCEL_SUBSCRIPTION' | 'UPGRADE_PLAN' | 'ACCOUNT_RECOVERY' | 'GREETING' | 'PRICING' | 'SECURITY' | 'FEEDBACK' | 'IMAGE_GENERATION' | 'IMAGE_ANALYSIS' | 'DEEP_RESEARCH' | 'CLEAR_CHAT' | 'NONE';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  image?: string;
  attachment?: {
    name: string;
    mimeType: string;
    data: string;
  };
  metadata?: {
    matchScore?: number;
    matchedQuestion?: string;
    source?: 'local-nlp' | 'gemini-ai';
    category?: string;
    detectedIntent?: Intent;
    groundingChunks?: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface MatchResult {
  faq: FAQItem;
  score: number;
}

export interface Vector {
  [term: string]: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}
