// utils/llm/core/types.ts
// LLM系统核心类型定义

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  apiKey?: string;
  stream?: boolean;
  max_tokens?: number;
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  repetition_penalty?: number;
  stop?: string[];
  stop_sequences?: string[];
  seed?: number;
  response_format?: { type: string };
  response_mime_type?: string;
  thinking?: ThinkingConfig;
  reasoning_effort?: 'low' | 'high'; // Grok 推理努力控制
  search_parameters?: SearchParameters; // Grok 实时搜索
  safety_settings?: SafetySetting[];
  tools?: any[];
  tool_choice?: string | { type: string };
  system?: string;
  system_instruction?: { parts: Array<{ text: string }> };
  bypass_proxy?: boolean;
  skip_connection_check?: boolean;
  api_options?: ApiOptions;
  model_id?: string;
  // 图像生成参数 (Grok)
  prompt?: string; // 用于图像生成
  n?: number; // 生成图像数量
  response_format_image?: 'url' | 'b64_json'; // 图像响应格式
  [key: string]: any;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'developer' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: any; [key: string]: any }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ThinkingConfig {
  enabled?: boolean;
  budget_tokens?: number | ParameterRange;
  type?: 'low' | 'medium' | 'high' | string;
  include_thoughts?: boolean;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface ApiOptions {
  timeout?: number;
  retries?: number;
  [key: string]: any;
}

export interface ModelCapabilities {
  temperature?: ParameterRange;
  top_p?: ParameterRange;
  top_k?: ParameterRange;
  max_tokens?: ParameterRange;
  presence_penalty?: ParameterRange;
  frequency_penalty?: ParameterRange;
  stop_sequences?: { max_count: number };
  thinking?: boolean | ThinkingCapabilities;
  tools?: boolean;
  vision?: boolean;
  system_instructions?: boolean;
  documents?: boolean;
}

export interface ParameterRange {
  min: number;
  max: number;
  default: number;
}

export interface ThinkingCapabilities {
  enabled: boolean;
  budget_tokens?: ParameterRange;
  include_thoughts?: boolean;
}

export interface ModelConfig {
  provider: LLMProvider;
  apiModel: string;
  isReasoner?: boolean;
  knowledgeCutoff?: string; // 知识截断时间，如 '2024-06', '2023-10'
  supports?: {
    temperature?: ParameterRange;
    top_p?: ParameterRange;
    top_k?: ParameterRange;
    max_tokens?: ParameterRange;
    presence_penalty?: ParameterRange;
    frequency_penalty?: ParameterRange;
    repetition_penalty?: ParameterRange;
    stop_sequences?: { max_count: number };
    thinking?: boolean | ThinkingConfig;
    reasoning?: boolean; // 推理功能
    reasoning_effort?: ReasoningEffortConfig; // Grok 推理努力
    tools?: boolean;
    vision?: boolean;
    image_input?: ImageInputSupport; // 图像输入支持
    image_generation?: ImageGenerationSupport; // 图像生成支持
    system_instructions?: boolean;
    documents?: boolean;
    search?: boolean; // 实时搜索支持
    structured_output?: boolean; // 结构化输出
  };
}

export interface StreamChunk {
  type: 'content_chunk' | 'thinking_step' | 'tool_use_step' | 'error_chunk';
  content?: string;
  thinking?: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_arguments?: any;
  error?: string;
  finish_reason?: string;
}

export interface LLMResponse {
  content: string;
  thinking?: string;
  tool_calls?: any[];
  images?: any[]; // 图像生成结果
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens?: number;
    cached_tokens?: number;
  };
}

export type StreamCallback = (chunk: string, type: StreamChunkType) => void;

export type StreamChunkType = 
  | 'content_chunk' 
  | 'thinking_step' 
  | 'tool_use_step' 
  | 'error' 
  | 'done';

export enum LLMProvider {
  DEEPSEEK = 'deepseek',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  XAI = 'xai',
  COHERE = 'cohere',
  MISTRAL = 'mistral'
}

export interface SearchParameters {
  mode?: 'off' | 'auto' | 'on';
  return_citations?: boolean;
  from_date?: string; // ISO8601 格式
  to_date?: string; // ISO8601 格式
  sources?: SearchSource[];
}

export interface SearchSource {
  type: 'web' | 'x' | 'news' | 'rss';
  country?: string;
  excluded_websites?: string[];
  safe_search?: boolean;
  x_handles?: string[];
  links?: string[];
}

export interface ReasoningEffortConfig {
  enabled: boolean;
  options: ('low' | 'high')[];
  default: 'low' | 'high';
}

export interface ImageGenerationSupport {
  enabled: boolean;
  max_images: number;
  response_formats: ('url' | 'b64_json')[];
  prompt_revision?: boolean;
}

export interface ImageInputSupport {
  max_images: number;
  max_size_mb: number;
  supported_formats: string[];
  token_calculation?: 'tile_based' | 'fixed';
} 