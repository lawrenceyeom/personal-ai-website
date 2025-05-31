// You can include shared interfaces/types in a separate file
// and then use them in any component by importing them. For
// example, to import the interface below do:
//
// import { User } from 'path/to/interfaces';

// Common interface definitions for the AI chat application
import { LLMRequest } from '../utils/llm';
import { UploadedFile } from '../components/ChatInput';

// 搜索结果接口
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
}

// 搜索响应接口
export interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  summary?: string;
  error?: string;
  totalResults?: number;
  searchTime?: number;
}

// Message interface for chat messages
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'search';  // 添加 'search' 类型
  content: string | any;
  thinking?: string;  // AI思考过程内容
  isThinking?: boolean; // 是否正在思考中
  imageUrl?: string;
  aiImageData?: { mime_type: string; data: string; };
  tool_call_id?: string;
  name?: string;
  timestamp?: number;
  files?: UploadedFile[]; // 上传的文件信息
  
  // 搜索相关字段
  isSearching?: boolean;  // 是否正在搜索中
  searchResults?: SearchResponse;  // 搜索结果
  searchQuery?: string;  // 搜索查询
}

// Session interface for chat history
export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  model: LLMRequest['model'];
  lastUpdated: number;
  reasoningStepsContent?: string;
  archived?: boolean;  // 是否已归档
}

// LLM Provider information
export interface LLMProviderInfo {
  id: string;
  name: string;
  disabled?: boolean;
}

// Model information
export interface ModelInfo {
  value: string;
  label: string;
  disabled?: boolean;
}

// User profile information
export interface User {
  id: number;
  name: string;
  email?: string;
  apiKeys?: {
    [provider: string]: string;
  };
}
