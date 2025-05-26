// utils/llmProviders.ts
// 多模型API请求封装，支持流式SSE和高级参数配置

// 导入必要模块
import axios from 'axios';
import { HttpsProxyAgent as HttpsProxyAgentActual } from 'https-proxy-agent'; // Direct import
// 新增库用于DeepSeek
import fetch from 'node-fetch';
import { HttpsProxyAgent as HpHttpsProxyAgent } from 'hpagent';

// Declaring HttpsProxyAgent type without importing directly
type HttpsProxyAgentType = any;

// Connectivity settings
const API_TIMEOUT_MS = 60000; // 增加到60秒timeout适应reasoning模型

// 代理设置（使用环境变量方式）
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:7890'; // 默认代理设置
let useProxy = false; // 默认不启用代理，将通过检测来决定

// 代理配置和检测逻辑
if (typeof process !== 'undefined' && process.env) {
  // 在生产环境中默认不使用代理，除非明确设置
  if (process.env.NODE_ENV === 'production') {
    useProxy = process.env.USE_PROXY === 'true';
  } else {
    // 开发环境保持原有逻辑
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || PROXY_URL;
    process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || PROXY_URL;
    useProxy = true; // 服务端默认启用代理
  }
  
  if (useProxy) {
    console.log('API代理已通过环境变量配置');
  } else {
    console.log('生产环境：代理已禁用');
  }
}

// 创建代理agent - 只在Node.js环境中使用
let httpsProxyAgent: any = null;
if (typeof window === 'undefined' && useProxy) {
  try {
    httpsProxyAgent = new HttpsProxyAgentActual(PROXY_URL);
    console.log(`API代理已配置：${PROXY_URL}`);
  } catch (e: any) {
    console.error('代理设置失败:', e.message);
    httpsProxyAgent = null; // 确保代理失败时为null
  }
} else {
  console.log('HttpsProxyAgent not configured (client side or proxy disabled) (llmProviders.ts)');
}

// 简单的网络连接检测（仅在服务端）
async function checkConnection(url: string): Promise<boolean> {
  if (typeof window !== 'undefined') return true; // 客户端环境不检测
  
  try {
    // 使用axios替代fetch进行连接检测
    const axiosConfig: any = {
      method: 'HEAD',
      url: url,
      timeout: 5000
    };
    
    // 仅在代理可用时添加代理
    if (useProxy && httpsProxyAgent) {
      axiosConfig.httpsAgent = httpsProxyAgent;
    }
    
    const response = await axios.request(axiosConfig);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.warn(`无法连接到 ${url}`, error);
    return false;
  }
}

export interface LLMRequest {
  model: string;
  messages: { 
    role: 'user' | 'assistant' | 'system' | 'tool'; 
    content: string | any; 
    tool_call_id?: string; 
    name?: string 
  }[];
  apiKey?: string;
  stream?: boolean;
  max_tokens?: number;
  max_output_tokens?: number; // Gemini用这个名字
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
  thinking?: { budget_tokens?: number; type?: string };
  safety_settings?: Array<{
    category: string;
    threshold: string;
  }>;
  tools?: any[];
  tool_choice?: string | { type: string };
  system?: string;
  system_instruction?: { parts: Array<{ text: string }> };
  bypass_proxy?: boolean;
  skip_connection_check?: boolean;
  api_options?: {
    skipConnectionCheck?: boolean;
    bypassProxy?: boolean;
  };
  model_id?: string; // This will store the actual API model identifier
  [key: string]: any;
}

// Constants for API keys - 移除硬编码密钥，改为环境变量
// 注意：这些密钥应该通过环境变量设置，不应硬编码在代码中
const DEFAULT_DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''; // 移除硬编码
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; // 移除硬编码
const DEFAULT_GPT_API_KEY = process.env.OPENAI_API_KEY || ''; // 移除硬编码
const DEFAULT_GROK_API_KEY = process.env.GROK_API_KEY || ''; // 移除硬编码

// 用于标题总结的加密DeepSeek密钥 (Base64编码 + 字符串混淆)
const ENCRYPTED_TITLE_SUMMARY_KEY = 'c2stMDAyMTgxN2MzODllNGI0ZTljOGY0M2EwYjY5MDYxZDY=';

// 解密函数
function decryptTitleSummaryKey(): string {
  try {
    // Base64解码
    const decoded = Buffer.from(ENCRYPTED_TITLE_SUMMARY_KEY, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    console.error('Failed to decrypt title summary key:', error);
    return '';
  }
}

// Debug function to log provider events
function debugLog(provider: string, type: string, message: any) {
  console.log(`[${provider.toUpperCase()}-DEBUG] ${type}: ${typeof message === 'object' ? JSON.stringify(message) : message}`);
}

// Function to validate and clean parameters based on model capabilities
function validateAndCleanParameters(req: LLMRequest): LLMRequest {
  const modelInfo = MODEL_MAPPING[req.model];
  if (!modelInfo || !modelInfo.supports) {
    return req;
  }

  const cleaned: LLMRequest = { ...req };
  const supports = modelInfo.supports;

  // Validate temperature
  if (cleaned.temperature !== undefined && supports.temperature) {
    cleaned.temperature = Math.max(supports.temperature.min, 
      Math.min(supports.temperature.max, cleaned.temperature));
  } else if (!supports.temperature) {
    delete cleaned.temperature;
  }

  // Validate top_p
  if (cleaned.top_p !== undefined && supports.top_p) {
    cleaned.top_p = Math.max(supports.top_p.min, 
      Math.min(supports.top_p.max, cleaned.top_p));
  } else if (!supports.top_p) {
    delete cleaned.top_p;
  }

  // Validate top_k
  if (cleaned.top_k !== undefined && supports.top_k) {
    cleaned.top_k = Math.max(supports.top_k.min, 
      Math.min(supports.top_k.max, cleaned.top_k));
  } else if (!supports.top_k) {
    delete cleaned.top_k;
  }

  // Validate max_tokens
  if (cleaned.max_tokens !== undefined && supports.max_tokens) {
    cleaned.max_tokens = Math.max(supports.max_tokens.min, 
      Math.min(supports.max_tokens.max, cleaned.max_tokens));
  }

  // Validate presence_penalty
  if (cleaned.presence_penalty !== undefined && supports.presence_penalty) {
    cleaned.presence_penalty = Math.max(supports.presence_penalty.min, 
      Math.min(supports.presence_penalty.max, cleaned.presence_penalty));
  } else if (!supports.presence_penalty) {
    delete cleaned.presence_penalty;
  }

  // Validate frequency_penalty
  if (cleaned.frequency_penalty !== undefined && supports.frequency_penalty) {
    cleaned.frequency_penalty = Math.max(supports.frequency_penalty.min, 
      Math.min(supports.frequency_penalty.max, cleaned.frequency_penalty));
  } else if (!supports.frequency_penalty) {
    delete cleaned.frequency_penalty;
  }

  // Validate stop_sequences
  if (cleaned.stop_sequences && supports.stop_sequences) {
    cleaned.stop_sequences = cleaned.stop_sequences.slice(0, supports.stop_sequences.max_count);
  } else if (!supports.stop_sequences) {
    delete cleaned.stop_sequences;
  }

  // Handle thinking parameter
  if (cleaned.thinking && !supports.thinking) {
    delete cleaned.thinking;
  }

  // Handle tools parameter
  if (cleaned.tools && !supports.tools) {
    delete cleaned.tools;
    delete cleaned.tool_choice;
  }

  // Handle system instructions
  if (cleaned.system && !supports.system_instructions) {
    delete cleaned.system;
  }

  return cleaned;
}

// Model mapping - UI selector value to actual API model IDs and provider
export const MODEL_MAPPING: Record<string, { 
  provider: string; 
  apiModel: string; 
  isReasoner?: boolean;
  supports?: {
    temperature?: { min: number; max: number; default: number };
    top_p?: { min: number; max: number; default: number };
    top_k?: { min: number; max: number; default: number };
    max_tokens?: { min: number; max: number; default: number };
    presence_penalty?: { min: number; max: number; default: number };
    frequency_penalty?: { min: number; max: number; default: number };
    stop_sequences?: { max_count: number };
    thinking?: boolean;
    tools?: boolean;
    vision?: boolean;
    system_instructions?: boolean;
  };
}> = {
  // OpenAI GPT-4.1 系列模型（最新发布 - 2025年4月）
  'gpt-4.1': {
    provider: 'gpt',
    apiModel: 'gpt-4.1-2025-04-14',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 32768, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'gpt-4.1-mini': {
    provider: 'gpt',
    apiModel: 'gpt-4.1-mini-2025-04-14',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 32768, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'gpt-4.1-nano': {
    provider: 'gpt',
    apiModel: 'gpt-4.1-nano-2025-04-14',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 32768, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // OpenAI o系列推理模型（最新发布 - 2025年4月）
  'o3': {
    provider: 'gpt',
    apiModel: 'o3-2025-04-16',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 100000, default: 1024 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'o3-mini': {
    provider: 'gpt',
    apiModel: 'o3-mini-2025-01-31',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 100000, default: 1024 },
      thinking: true,
      tools: true,
      vision: false,
      system_instructions: true
    }
  },
  'o4-mini': {
    provider: 'gpt',
    apiModel: 'o4-mini-2025-04-16',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 100000, default: 1024 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // OpenAI GPT-4o系列（仍然可用）
  'gpt-4o': { 
    provider: 'gpt', 
    apiModel: 'gpt-4o',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 4096, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'gpt-4o-mini': { 
    provider: 'gpt', 
    apiModel: 'gpt-4o-mini',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 16384, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'o1-mini': { 
    provider: 'gpt', 
    apiModel: 'o1-mini', 
    isReasoner: true,
    supports: {
      max_tokens: { min: 1, max: 65536, default: 1024 },
      tools: false,
      vision: false,
      system_instructions: false,
      thinking: true
    }
  },

  // Anthropic Claude 4 模型（最新发布 - 2025年5月）
  'claude-opus-4': { 
    provider: 'claude', 
    apiModel: 'claude-opus-4-20250514',
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 32000, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'claude-sonnet-4': { 
    provider: 'claude', 
    apiModel: 'claude-sonnet-4-20250514',
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 64000, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // Anthropic Claude 3.5 模型（仍然可用）
  'claude-3.5-sonnet': { 
    provider: 'claude', 
    apiModel: 'claude-3-5-sonnet-20241022',
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 8192, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'claude-3.5-haiku': { 
    provider: 'claude', 
    apiModel: 'claude-3-5-haiku-20241022',
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 8192, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // Google Gemini 2.5 模型（推理模型）
  'gemini-2.5-pro': { 
    provider: 'gemini', 
    apiModel: 'gemini-2.5-pro-preview-05-06',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.95 },
      top_k: { min: 1, max: 64, default: 64 },
      max_tokens: { min: 1, max: 65536, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'gemini-2.5-flash': { 
    provider: 'gemini', 
    apiModel: 'gemini-2.5-flash-preview-05-20',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 64, default: 64 },
      max_tokens: { min: 1, max: 65536, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // Google Gemini 1.5 模型（仍然可用）
  'gemini-1.5-pro': { 
    provider: 'gemini', 
    apiModel: 'gemini-1.5-pro-latest',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 64, default: 64 },
      max_tokens: { min: 1, max: 65536, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'gemini-1.5-flash': { 
    provider: 'gemini', 
    apiModel: 'gemini-1.5-flash-latest',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 64, default: 64 },
      max_tokens: { min: 1, max: 65536, default: 1024 },
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },

  // DeepSeek 最新模型
  'deepseek-v3': { 
    provider: 'deepseek', 
    apiModel: 'deepseek-chat',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 4096, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      tools: true,
      vision: false,
      system_instructions: true
    }
  },
  'deepseek-r1': { 
    provider: 'deepseek', 
    apiModel: 'deepseek-reasoner', 
    isReasoner: true,
    supports: {
      max_tokens: { min: 1, max: 8192, default: 1024 },
      thinking: true,
      tools: false,
      vision: false,
      system_instructions: false // DeepSeek-R1 不支持系统提示词
    }
  },

  // xAI Grok 3 系列模型（推理模型）
  'grok-3': { 
    provider: 'grok', 
    apiModel: 'grok-3',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      top_k: { min: 1, max: 40, default: 40 },
      max_tokens: { min: 1, max: 131072, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: true,
      tools: true,
      vision: true,
      system_instructions: true
    }
  },
  'grok-3-mini': { 
    provider: 'grok', 
    apiModel: 'grok-3-mini',
    isReasoner: true,
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 131072, default: 1024 },
      thinking: true,
      tools: true,
      vision: false,
      system_instructions: true
    }
  },

  // xAI Grok 2 模型（仍然可用） 
  'grok-2': { 
    provider: 'grok', 
    apiModel: 'grok-2',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      top_k: { min: 1, max: 40, default: 40 },
      max_tokens: { min: 1, max: 131072, default: 1024 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      tools: true,
      vision: true,
      system_instructions: true
    }
  }
};

// Get API key logic (already updated in previous step to use test keys as fallbacks)
const getApiKey = (providerId: string, providedKey?: string): string | undefined => {
  // 1. Use key provided directly in the request
  if (providedKey) {
    return providedKey;
  }
  
  // 2. Check environment variables first (server-side) - 优先使用环境变量
  if (typeof process !== 'undefined' && process.env) {
    let envKey;
    switch (providerId) {
      case 'deepseek':
        envKey = process.env.DEEPSEEK_API_KEY;
        break;
      case 'gpt':
        envKey = process.env.OPENAI_API_KEY;
        break;
      case 'gemini':
        envKey = process.env.GEMINI_API_KEY;
        break;
      case 'claude':
        envKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'grok':
        envKey = process.env.GROK_API_KEY;
        break;
    }
    
    if (envKey) {
      return envKey;
    }
  }

  // 3. Check localStorage for user-provided keys (client-side)
  if (typeof window !== 'undefined') {
    try {
      const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
      if (savedKeys[providerId]) {
        return savedKeys[providerId];
      }
    } catch (error) {
      console.error('读取API密钥时出错:', error);
    }
  }
    
  // 4. Fallback to default keys (仅在环境变量存在时使用)
  if (providerId === 'deepseek' && DEFAULT_DEEPSEEK_API_KEY) {
    return DEFAULT_DEEPSEEK_API_KEY;
  }
  if (providerId === 'gemini' && DEFAULT_GEMINI_API_KEY) {
    return DEFAULT_GEMINI_API_KEY;
  }
  if (providerId === 'gpt' && DEFAULT_GPT_API_KEY) {
    return DEFAULT_GPT_API_KEY;
  }
  if (providerId === 'grok' && DEFAULT_GROK_API_KEY) {
    return DEFAULT_GROK_API_KEY;
  }
  
  // 5. 特殊处理：DeepSeek标题总结密钥（仅服务端）
  if (providerId === 'deepseek' && typeof process !== 'undefined') {
    const titleSummaryKey = decryptTitleSummaryKey();
    if (titleSummaryKey) {
      console.log('Using encrypted title summary key for DeepSeek');
      return titleSummaryKey;
    }
  }
  
  return undefined; // No key found if all above fail
};

// onData accepts an optional stepType to categorize the chunk
export async function callLLMStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'step' | 'image_data') => void
): Promise<void> {
  const modelInfo = MODEL_MAPPING[req.model];
  if (!modelInfo) {
    throw new Error(`不支持的模型: ${req.model}`);
  }

  const apiKey = getApiKey(modelInfo.provider, req.apiKey);
  if (!apiKey) {
    throw new Error(`未找到${modelInfo.provider}的API密钥`);
  }

  // 验证和清理参数
  const cleanedReq = validateAndCleanParameters(req);
  
  // 添加提供商特定的调试信息
  debugLog(modelInfo.provider, 'REQUEST_PARAMS', {
    model: req.model,
    hasTemperature: cleanedReq.temperature !== undefined,
    hasTopP: cleanedReq.top_p !== undefined,
    hasMaxTokens: cleanedReq.max_tokens !== undefined,
    hasThinking: cleanedReq.thinking !== undefined,
    hasTools: cleanedReq.tools !== undefined && cleanedReq.tools.length > 0
  });

  // 根据提供商调用相应的函数
  // 对于中国大陆用户，国外API需要代理，DeepSeek可以选择不使用代理
  const shouldUseProxy = (provider: string) => {
    if (cleanedReq.bypass_proxy) return false; // 明确绕过代理
    
    // DeepSeek是国内API，可以根据用户设置决定是否使用代理
    if (provider === 'deepseek') {
      return !cleanedReq.skip_connection_check;
    }
    
    // 其他国外API在中国大陆需要代理（除非明确绕过）
    return true;
  };

  const requestWithMetadata = { ...cleanedReq, apiKey, model_id: modelInfo.apiModel };
  
  switch (modelInfo.provider) {
    case 'deepseek':
      return await callDeepSeekStream(requestWithMetadata, onData, shouldUseProxy('deepseek'));
    case 'gpt':
      return await callOpenAIStream(requestWithMetadata, onData, shouldUseProxy('gpt'));
    case 'claude':
      return await callClaudeStream(requestWithMetadata, onData, shouldUseProxy('claude'));
    case 'gemini':
      return await callGeminiStream(requestWithMetadata, onData, shouldUseProxy('gemini'));
    case 'grok':
      return await callGrokStream(requestWithMetadata, onData, shouldUseProxy('grok'));
    default:
      throw new Error(`不支持的提供商: ${modelInfo.provider}`);
  }
}

// DeepSeek流式SSE（chat/reasoner通用，reasoner需分步处理）
async function callDeepSeekStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'step' | 'image_data') => void,
  useAgent: boolean = false
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const apiKey = getApiKey('deepseek', req.apiKey);
    if (!apiKey) {
      onData(JSON.stringify({ error: 'DeepSeek API密钥未设置。请在设置页面添加API密钥或检查默认密钥。' }), 'error_chunk');
      return reject(new Error('DeepSeek API key not set'));
    }

    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const isReasoner = req.model_id === 'deepseek-reasoner';
    
    const bodyParams: any = {
      model: req.model_id,
      messages: req.messages,
      stream: true,
    };

    if (isReasoner) {
      // DeepSeek-R1 (reasoner) 特殊处理
      if (req.max_tokens) bodyParams.max_tokens = req.max_tokens;
      // DeepSeek-R1 不支持 temperature, top_p, tools, system instructions
      // 这些参数会被忽略但不会报错（为了兼容性）
    } else {
      // DeepSeek-V3 常规模型
      bodyParams.max_tokens = req.max_tokens || 4096;
      
      // 根据DeepSeek官方推荐的temperature设置
      if (req.temperature !== undefined) {
        bodyParams.temperature = req.temperature;
      } else {
        // 默认值基于用途：编程/数学用0.0，通用对话用1.3
        bodyParams.temperature = 1.0;
      }
      
      if (req.top_p !== undefined) bodyParams.top_p = req.top_p;
      if (req.presence_penalty !== undefined) bodyParams.presence_penalty = req.presence_penalty;
      if (req.frequency_penalty !== undefined) bodyParams.frequency_penalty = req.frequency_penalty;
      if (req.stop_sequences && req.stop_sequences.length > 0) {
        bodyParams.stop = req.stop_sequences.slice(0, 4); // 最多4个
      }
      
      if (req.tools && req.tools.length > 0) {
        bodyParams.tools = req.tools;
        if (req.tool_choice) {
          bodyParams.tool_choice = req.tool_choice;
        }
      }
    }

    const body = JSON.stringify(bodyParams);

    try {
      console.log('DeepSeek API Request (node-fetch):', { 
        model: req.model_id, 
        messages: req.messages.length,
        bodyLength: body.length, 
        isReasoner,
        useProxy: useAgent ? 'true' : 'false'
      });
      
      const apiUrl = 'https://api.deepseek.com/chat/completions';
      
      // 使用node-fetch和hpagent替代axios
      let fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: body,
      };
      
      // 配置代理
      if (useAgent && useProxy) {
        // 使用hpagent的HttpsProxyAgent替代HttpsProxyAgentActual
        const hpAgent = new HpHttpsProxyAgent({
          proxy: PROXY_URL,
          timeout: API_TIMEOUT_MS,
        });
        fetchOptions.agent = hpAgent;
        console.log('DeepSeek API使用代理 (HpHttpsProxyAgent)');
      } else {
        console.log('DeepSeek API不使用代理 (node-fetch)');
      }
      
      // 设置超时功能
      const timeout = API_TIMEOUT_MS;
      let fetchPromise = fetch(apiUrl, fetchOptions);
      
      // Apply timeout manually since node-fetch doesn't have built-in timeout
      const timeoutPromise = new Promise<any>((_, rejectTimeout) => {
        setTimeout(() => rejectTimeout(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`DeepSeek API HTTP error: ${response.status} ${response.statusText}`, errorBody);
        const errorMsg = `DeepSeek API Error: ${response.status} ${response.statusText} - ${errorBody}`;
        onData(JSON.stringify({ error: errorMsg }), 'error_chunk');
        return reject(new Error(errorMsg));
      }

      console.log('DeepSeek response status:', response.status);

      // Simplified stream handling - using buffer chunks directly
      const reader = response.body;
      if (!reader) {
        const errorMsg = "No response body from DeepSeek API";
        onData(JSON.stringify({ error: errorMsg }), 'error_chunk');
        return reject(new Error(errorMsg));
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      // Process stream chunk by chunk
      reader.on('data', (chunk: Buffer) => {
        const text = decoder.decode(chunk, { stream: true });
        debugLog('deepseek', 'CHUNK_RECEIVED', `Length: ${text.length}`);
        console.log('DeepSeek chunk received, length:', text.length);
        buffer += text;
        
        // Process complete events from the buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last potentially incomplete chunk
        
        lines.forEach(line => {
          if (!line.trim()) return;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            debugLog('deepseek', 'DATA', data.substring(0, 200)); // Log the data payload
            
            if (data === '[DONE]') {
              console.log('DeepSeek stream complete signal received');
              onData(JSON.stringify({ finish_reason: 'stop' }), 'content_chunk');
              return;
            }
            
            try {
              const json = JSON.parse(data);
              debugLog('deepseek', 'PARSED_JSON', JSON.stringify(json).substring(0, 300));
              console.log('DeepSeek parsed JSON:', JSON.stringify(json).slice(0, 100) + '...');
              
              if (json.choices && json.choices[0]) {
                const delta = json.choices[0].delta;
                debugLog('deepseek', 'DELTA', delta);
                
                if (delta.content) {
                  debugLog('deepseek', 'CONTENT', delta.content);
                  onData(JSON.stringify({ content: delta.content }), 'content_chunk');
                } else if (isReasoner && delta.reasoning_content) {
                  debugLog('deepseek', 'REASONING', delta.reasoning_content);
                  onData(JSON.stringify({ reasoning_content: delta.reasoning_content }), 'thinking_step');
                } else if (delta.tool_calls && delta.tool_calls.length > 0) {
                  const toolCall = delta.tool_calls[0];
                  debugLog('deepseek', 'TOOL_CALL', toolCall);
                  onData(JSON.stringify({
                    tool_call_id: toolCall.id,
                    tool_name: toolCall.function?.name,
                    tool_arguments: toolCall.function?.arguments
                  }), 'tool_use_step');
                }
                
                if (json.choices[0].finish_reason) {
                  debugLog('deepseek', 'FINISH_REASON', json.choices[0].finish_reason);
                  onData(JSON.stringify({ finish_reason: json.choices[0].finish_reason }), 'content_chunk');
                }
              }
            } catch (err) {
              console.error('DeepSeek JSON parse error:', err, 'Raw data:', data);
              debugLog('deepseek', 'PARSE_ERROR', err.message);
            }
          }
        });
      });
      
      reader.on('error', (err) => {
        console.error('DeepSeek stream error:', err);
        onData(JSON.stringify({ error: `Stream error: ${err.message}` }), 'error_chunk');
        reject(err);
      });
      
      reader.on('end', () => {
        console.log('DeepSeek stream ended');
        // Handle any remaining buffer data
        if (buffer && buffer.startsWith('data: ')) {
          try {
            const data = buffer.slice(6);
            if (data !== '[DONE]') {
              const json = JSON.parse(data);
              if (json.choices && json.choices[0]?.delta?.content) {
                onData(JSON.stringify({ content: json.choices[0].delta.content }), 'content_chunk');
              }
            }
          } catch (e) {
            // Ignore parsing errors in the final buffer chunk
          }
        }
        resolve();
      });
    } catch (error: any) {
      console.error('DeepSeek stream error (outer):', error);
      onData(JSON.stringify({ 
        error: error.message || 'Failed to fetch from DeepSeek API',
        details: (error.response?.status ? `Status: ${error.response.status}` : '') + 
                 (error.response?.data ? ` Data: ${JSON.stringify(error.response.data)}` : '')
      }), 'error_chunk');
      reject(error);
    }
  });
}

// OpenAI (GPT) implementation 
async function callOpenAIStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'image_data') => void,
  useAgent: boolean = false
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const apiKey = getApiKey('gpt', req.apiKey);
    if (!apiKey) {
      onData(JSON.stringify({ error: 'OpenAI API密钥未设置。请在设置页面添加API密钥或检查测试密钥。' }), 'error_chunk');
      return reject(new Error('OpenAI API key not set'));
    }

    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const messages = req.messages.map(m => {
      if (m.role === 'tool') { 
        return { role: 'tool', tool_call_id: m.tool_call_id, name: m.name, content: m.content };
      }
      return { role: m.role, content: m.content };
    });
    
    const modelId = req.model_id;
    const apiBaseUrl = 'https://api.openai.com/v1/chat/completions';

    // 通过MODEL_MAPPING中的isReasoner检查是否是推理模型
    const modelDetails = MODEL_MAPPING[req.model];
    const isReasoner = modelDetails?.isReasoner || false;

    // 构建请求体
    const bodyParams: any = {
      model: modelId,
      messages: messages,
      stream: true,
    };

    if (isReasoner) {
      // o1-mini, o3-mini等推理模型使用不同的参数
      bodyParams.max_completion_tokens = req.max_tokens || 4096;
      // 注意：o1-mini不支持reasoning_effort参数，只有o3支持
      if (modelId.includes('o3')) {
        bodyParams.reasoning_effort = 'medium';
      }
      // 推理模型不支持temperature等参数
    } else {
      // 常规GPT模型
      bodyParams.max_tokens = req.max_tokens || 4096;
      
      // 参数设置
      if (req.temperature !== undefined) bodyParams.temperature = req.temperature;
      if (req.top_p !== undefined) bodyParams.top_p = req.top_p;
      if (req.presence_penalty !== undefined) bodyParams.presence_penalty = req.presence_penalty;
      if (req.frequency_penalty !== undefined) bodyParams.frequency_penalty = req.frequency_penalty;
      if (req.seed !== undefined) bodyParams.seed = req.seed;
      
      if (req.stop_sequences && req.stop_sequences.length > 0) {
        bodyParams.stop = req.stop_sequences.slice(0, 4); // OpenAI最多支持4个
      }
      
      // 响应格式
      if (req.response_format) {
        bodyParams.response_format = req.response_format;
      }
    }

    // 工具调用支持（仅非推理模型）
    if (!isReasoner && req.tools && req.tools.length > 0) {
      bodyParams.tools = req.tools;
      if (req.tool_choice) {
        bodyParams.tool_choice = req.tool_choice;
      } else {
        bodyParams.tool_choice = "auto";
      }
    }

    const body = JSON.stringify(bodyParams);

    try {    
      console.log('OpenAI API Request:', { 
        model: modelId, 
        bodyLength: body.length, 
        isReasoner, 
        useProxy: useAgent ? 'true' : 'false',
        messages: messages.length
      });
          
      // 使用node-fetch和hpagent替代axios
      let fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: body,
      };
      
      // 配置代理
      if (useAgent && useProxy) {
        // 使用hpagent的HttpsProxyAgent替代HttpsProxyAgentActual
        const hpAgent = new HpHttpsProxyAgent({
          proxy: PROXY_URL,
          timeout: API_TIMEOUT_MS,
        });
        fetchOptions.agent = hpAgent;
        console.log('OpenAI API使用代理 (HpHttpsProxyAgent)');
      } else {
        console.log('OpenAI API不使用代理 (node-fetch)');
      }
      
      // 设置超时功能
      const timeout = API_TIMEOUT_MS;
      let fetchPromise = fetch(apiBaseUrl, fetchOptions);
      
      // Apply timeout manually since node-fetch doesn't have built-in timeout
      const timeoutPromise = new Promise<any>((_, rejectTimeout) => {
        setTimeout(() => rejectTimeout(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenAI API HTTP error: ${response.status} ${response.statusText}`, errorBody);
        const errorMsg = `OpenAI API Error: ${response.status} ${response.statusText} - ${errorBody}`;
        onData(JSON.stringify({ error: errorMsg }), 'error_chunk');
        return reject(new Error(errorMsg));
      }

      console.log('OpenAI response status:', response.status);

      if (!response.body) {
        const errorMsg = `OpenAI API Error [${modelId}]: 响应中没有数据流`;
        console.error('OpenAI API Error:', modelId, 'No body in response');
        onData(JSON.stringify({ error: errorMsg }), 'error_chunk');
        return reject(new Error(errorMsg));
      }

      // 处理流式响应 - 简化版
      const reader = response.body;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedToolCallDeltas: { [key: number]: { id?: string, name?: string, arguments?: string } } = {};

      reader.on('data', (chunk: Buffer) => {
        const text = decoder.decode(chunk, { stream: true });
        debugLog('openai', 'CHUNK_RECEIVED', `Length: ${text.length}`);
        console.log('OpenAI chunk received, length:', text.length);
        buffer += text;
        
        // Process complete lines
        let lineEndIndex;
        while ((lineEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const line = buffer.substring(0, lineEndIndex);
          buffer = buffer.substring(lineEndIndex + 2);

          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            debugLog('openai', 'DATA', data.substring(0, 200));
            
            if (data === '[DONE]') {
              // Process any remaining accumulated tool calls before finishing
              for (const index in accumulatedToolCallDeltas) {
                const toolCall = accumulatedToolCallDeltas[index];
                if (toolCall.id && toolCall.name && toolCall.arguments) {
                  try {
                    const parsedArgs = JSON.parse(toolCall.arguments);
                    onData(JSON.stringify({ 
                      tool_call_id: toolCall.id, 
                      tool_name: toolCall.name, 
                      tool_arguments: parsedArgs 
                    }), 'tool_use_step');
                  } catch(e) {
                    onData(JSON.stringify({ 
                      tool_call_id: toolCall.id, 
                      tool_name: toolCall.name, 
                      tool_arguments_raw: toolCall.arguments 
                    }), 'tool_use_step');
                  }
                }
              }
              accumulatedToolCallDeltas = {};
              debugLog('openai', 'DONE', 'Stream complete');
              onData(JSON.stringify({ finish_reason: 'stop' }), 'content_chunk');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              debugLog('openai', 'PARSED_JSON', JSON.stringify(parsed).substring(0, 300));
              console.log('OpenAI parsed JSON:', JSON.stringify(parsed).slice(0, 100) + '...');
              
              if (parsed.choices && parsed.choices[0].delta) {
                const delta = parsed.choices[0].delta;
                debugLog('openai', 'DELTA', delta);

                if (delta.content) {
                  debugLog('openai', 'CONTENT', delta.content);
                  onData(JSON.stringify({ content: delta.content }), 'content_chunk');
                }

                // Handle reasoning content for o1, o3 models
                if (isReasoner) {
                  // Check for reasoning summary in o3/o4-mini models
                  if (parsed.choices[0]?.delta?.reasoning_summary) {
                    debugLog('openai', 'REASONING_SUMMARY', parsed.choices[0].delta.reasoning_summary);
                    onData(JSON.stringify({ reasoning_content: parsed.choices[0].delta.reasoning_summary }), 'thinking_step');
                  }
                  
                  // For o1/o3/o4 models, check for reasoning in the content itself
                  if (delta.content && delta.content.includes('reasoning') && !parsed.choices[0]?.delta?.reasoning_summary) {
                    // Some OpenAI reasoning models might include reasoning in content
                    onData(JSON.stringify({ reasoning_content: delta.content }), 'thinking_step');
                  }
                  
                  // Check for reasoning tokens metadata
                  if (parsed.choices[0]?.usage?.completion_tokens_details?.reasoning_tokens) {
                    debugLog('openai', 'REASONING_TOKENS', parsed.choices[0].usage.completion_tokens_details.reasoning_tokens);
                    // Only show placeholder if we haven't received actual reasoning content
                    if (!parsed.choices[0]?.delta?.reasoning_summary && !delta.content?.includes('reasoning')) {
                      onData(JSON.stringify({ 
                        reasoning_content: `[Model is reasoning internally using ${parsed.choices[0].usage.completion_tokens_details.reasoning_tokens} tokens]` 
                      }), 'thinking_step');
                    }
                  }
                }

                if (delta.tool_calls) {
                  debugLog('openai', 'TOOL_CALLS', delta.tool_calls);
                  for (const toolCallDelta of delta.tool_calls) {
                    const index = toolCallDelta.index;
                    if (!accumulatedToolCallDeltas[index]) {
                      accumulatedToolCallDeltas[index] = { arguments: '' };
                    }
                    if (toolCallDelta.id) accumulatedToolCallDeltas[index].id = toolCallDelta.id;
                    if (toolCallDelta.function?.name) accumulatedToolCallDeltas[index].name = toolCallDelta.function.name;
                    if (toolCallDelta.function?.arguments) accumulatedToolCallDeltas[index].arguments += toolCallDelta.function.arguments;
                  }
                }

                // If finish_reason is present, process it
                if (parsed.choices[0].finish_reason) {
                  debugLog('openai', 'FINISH_REASON', parsed.choices[0].finish_reason);
                  // Process any complete tool calls first
                  for (const index in accumulatedToolCallDeltas) {
                    const toolCall = accumulatedToolCallDeltas[index];
                    if (toolCall.id && toolCall.name && toolCall.arguments) {
                      try {
                        const parsedArgs = JSON.parse(toolCall.arguments);
                        onData(JSON.stringify({ 
                          tool_call_id: toolCall.id, 
                          tool_name: toolCall.name, 
                          tool_arguments: parsedArgs 
                        }), 'tool_use_step');
                      } catch(e) {
                        onData(JSON.stringify({ 
                          tool_call_id: toolCall.id, 
                          tool_name: toolCall.name, 
                          tool_arguments_raw: toolCall.arguments 
                        }), 'tool_use_step');
                      }
                    }
                  }
                  accumulatedToolCallDeltas = {}; 
                  onData(JSON.stringify({ finish_reason: parsed.choices[0].finish_reason }), 'content_chunk');
                }
              }
            } catch (e) {
              console.error('Error parsing OpenAI JSON:', data, e);
              debugLog('openai', 'PARSE_ERROR', e.message);
              if (data.includes('error')) {
                try {
                  const errorObj = JSON.parse(data);
                  onData(JSON.stringify({ 
                    error: 'OpenAI API错误',
                    details: errorObj.error?.message || '未知错误'
                  }), 'error_chunk');
                } catch (parseErr) {
                  console.error('Failed to parse OpenAI error JSON:', parseErr);
                }
              }
            }
          }
        }
      });

      reader.on('end', () => {
        console.log('OpenAI stream ended');
        // 处理可能的剩余buffer
        if (buffer.length > 0 && buffer.startsWith('data: ')) {
          try {
            const data = buffer.substring(6).trim();
            if (data !== '[DONE]') {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                onData(JSON.stringify({ content: parsed.choices[0].delta.content }), 'content_chunk');
              }
            }
          } catch (e) {
            // 最后的buffer可能不是完整的JSON，忽略
          }
        }
        resolve();
      });

      reader.on('error', (err: any) => {
        console.error('OpenAI stream error:', err);
        onData(JSON.stringify({ 
          error: err.message || 'Stream error',
          details: err.code || 'Unknown error code' 
        }), 'error_chunk');
        reject(err);
      });
    } catch (error: any) {
      console.error('OpenAI stream error (outer):', error);
      
      let errorMessage = 'OpenAI API调用失败';
      let details = '';
      
      if (error.message) {
        details = error.message;
      }

      onData(JSON.stringify({ error: errorMessage, details: details }), 'error_chunk');
      reject(error);
    }
  });
}

// Google Gemini implementation
async function callGeminiStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'image_data') => void,
  useAgent: boolean = false
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const apiKey = getApiKey('gemini', req.apiKey);
      if (!apiKey) {
        onData(JSON.stringify({ error: 'Google API密钥未设置。请在设置页面添加API密钥或检查测试密钥。' }), 'error_chunk');
        return reject(new Error('Google API key not set'));
      }

      // req.model_id is set by callLLMStream from MODEL_MAPPING.
      // For Gemini API, it's typically models/gemini-1.5-pro or models/gemini-2.5-pro etc.
      let geminiApiIdentifier = req.model_id;
      if (!geminiApiIdentifier.startsWith('models/')) {
        geminiApiIdentifier = `models/${geminiApiIdentifier}`;
      }

      if (!apiKey.startsWith('AIzaSy')) {
        onData(JSON.stringify({ error: 'Google API密钥格式不正确。请确保密钥以AIzaSy开头。' }), 'error_chunk');
        return reject(new Error('Invalid Google API key format'));
      }
      
      const url = `https://generativelanguage.googleapis.com/v1beta/${geminiApiIdentifier}:streamGenerateContent?key=${apiKey}`;

      const contents = req.messages
        .filter(m => m.role === 'user' || m.role === 'assistant') 
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content as string }], 
        }));

      const modelDetails = MODEL_MAPPING[req.model];
      const supportsThinking = modelDetails?.supports?.thinking || false;
      
      const generationConfig: any = {
        maxOutputTokens: req.max_tokens || 4096,
      };

      // 参数设置
      if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
      if (req.top_p !== undefined) generationConfig.topP = req.top_p;
      if (req.top_k !== undefined) generationConfig.topK = req.top_k;
      
      if (req.stop_sequences && req.stop_sequences.length > 0) {
        generationConfig.stopSequences = req.stop_sequences.slice(0, 5); // Gemini最多支持5个
      }

      // Thinking configuration for 2.5 models
      if (supportsThinking) {
        if (req.thinking?.budget_tokens) {
          generationConfig.thinkingConfig = {
            thinkingBudget: req.thinking.budget_tokens,
            includeThoughts: true
          };
        } else {
          generationConfig.thinkingConfig = {
            includeThoughts: true
          };
        }
      }

      // 提取系统指令
      const systemMessage = req.messages.find(m => m.role === 'system');
      const systemInstruction = systemMessage && systemMessage.content 
        ? { system_instruction: { parts: [{ text: systemMessage.content as string }] } }
        : {};

      // 如果有自定义系统指令参数，优先使用
      if (req.system && req.system.trim()) {
        systemInstruction.system_instruction = { parts: [{ text: req.system }] };
      }

      const bodyPayload: any = {
        contents: contents,
        generationConfig: generationConfig,
        ...systemInstruction,
      };

      // 工具调用支持
      if (req.tools && req.tools.length > 0) {
        bodyPayload.tools = req.tools;
        if (req.tool_choice) {
          bodyPayload.tool_choice = req.tool_choice;
        }
      }

      const body = JSON.stringify(bodyPayload);
      
      console.log('Gemini API Request (node-fetch):', { 
        model: geminiApiIdentifier, 
        urlLength: url.length, 
        bodyLength: body.length,
        useProxy: useAgent ? 'true' : 'false'
      });
      
      // 使用node-fetch和hpagent替代axios
      let fetchOptions: any = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      };
      
      // 配置代理
      if (useAgent && useProxy) {
        // 使用hpagent的HttpsProxyAgent替代HttpsProxyAgentActual
        const hpAgent = new HpHttpsProxyAgent({
          proxy: PROXY_URL,
          timeout: API_TIMEOUT_MS,
        });
        fetchOptions.agent = hpAgent;
        console.log('Gemini API使用代理 (HpHttpsProxyAgent)');
      } else {
        console.log('Gemini API不使用代理 (node-fetch)');
      }
      
      // 设置超时功能
      const timeout = API_TIMEOUT_MS;
      let fetchPromise = fetch(url, fetchOptions);
      
      // Apply timeout manually since node-fetch doesn't have built-in timeout
      const timeoutPromise = new Promise<any>((_, rejectTimeout) => {
        setTimeout(() => rejectTimeout(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Gemini API HTTP error: ${response.status} ${response.statusText}`, errorBody);
        
        // Try to extract a more specific error message
        let errorMessage = `Gemini API Error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorBody);
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message;
            // Special handling for the thinking not supported error
            if (errorMessage.includes("thinking is not supported")) {
              errorMessage = `此Gemini模型 (${req.model}) 不支持thinking功能。请尝试其他模型。`;
            }
          }
        } catch (e) {
          // Use default error message if parsing fails
        }
        
        onData(JSON.stringify({ error: errorMessage, details: errorBody }), 'error_chunk');
        return reject(new Error(errorMessage));
      }
      
      console.log('Gemini response status:', response.status);
      
      if (!response.body) {
        console.error('Gemini API Error:', geminiApiIdentifier, 'No body in response');
        onData(JSON.stringify({ error: `Gemini API Error [${geminiApiIdentifier}]: 响应中没有数据流` }), 'error_chunk');
        return reject(new Error('No response body'));
      }

      // Process the stream using node-fetch's response.body (which is a Node.js ReadableStream, not a WHATWG stream)
      const reader = response.body;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      
      try {
        // Process the stream using a simple JSON object parser
        reader.on('data', (chunk: Buffer) => {
          const text = decoder.decode(chunk, { stream: true });
          console.log('Gemini chunk received, length:', text.length);
          buffer += text;
          
          // Process the buffer to extract JSON objects
          processGeminiBuffer(buffer, onData);
        });
        
        reader.on('end', () => {
          // Process any remaining buffer if possible
          if (buffer.trim()) {
            try {
              // Final attempt to extract JSON objects from the buffer
              processGeminiBuffer(buffer, onData);
            } catch (e) {
              console.log('Failed to process final Gemini buffer:', e);
            }
          }
          
          console.log('Gemini stream ended');
          resolve();
        });
        
        reader.on('error', (err) => {
          console.error('Error processing Gemini stream:', err);
          onData(JSON.stringify({ 
            error: 'Error processing Gemini stream', 
            details: err.message 
          }), 'error_chunk');
          reject(err);
        });
      } catch (streamError) {
        console.error('Error processing Gemini stream:', streamError);
        onData(JSON.stringify({ 
          error: 'Error processing Gemini stream', 
          details: streamError.message 
        }), 'error_chunk');
        return reject(streamError);
      }
      
      // Helper function to process the Gemini buffer and extract JSON objects
      const processGeminiBuffer = (inputBuffer: string, callback: typeof onData) => {
        // Remove array brackets and extra commas that might interfere with parsing
        let cleanBuffer = inputBuffer;
        
        // Remove leading array bracket and trailing comma
        if (cleanBuffer.trim().startsWith('[')) {
          cleanBuffer = cleanBuffer.trim().substring(1);
        }
        
        // Try to find and process complete JSON objects in the buffer
        let objStartIdx = cleanBuffer.indexOf('{');
        while (objStartIdx !== -1) {
          // Find the matching closing brace by counting braces
          let braceCount = 0;
          let objEndIdx = -1;
          
          for (let i = objStartIdx; i < cleanBuffer.length; i++) {
            if (cleanBuffer[i] === '{') braceCount++;
            else if (cleanBuffer[i] === '}') braceCount--;
            
            if (braceCount === 0) {
              objEndIdx = i;
              break;
            }
          }
          
          // If we found a complete JSON object
          if (objEndIdx !== -1) {
            const jsonStr = cleanBuffer.substring(objStartIdx, objEndIdx + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              
              // Process the parsed object based on its content
              if (parsed.candidates && parsed.candidates[0]) {
                const candidate = parsed.candidates[0];
                
                // Extract and send text content, thinking, and function calls
                if (candidate.content && candidate.content.parts) {
                  for (const part of candidate.content.parts) {
                    if (part.text) {
                      callback(JSON.stringify({ content: part.text }), 'content_chunk');
                    } else if (part.thought) {
                      // Handle Gemini thinking content
                      callback(JSON.stringify({ reasoning_content: part.thought }), 'thinking_step');
                    } else if (part.functionCall) {
                      // Send function call information as a tool_use_step
                      // If a specific function name indicates a reasoning step, 
                      // we could map it to 'thinking_step' here.
                      callback(JSON.stringify({
                        tool_name: part.functionCall.name,
                        tool_arguments: part.functionCall.args, // Gemini uses 'args'
                        // Gemini function calls don't have an explicit ID in this part of the stream typically
                      }), 'tool_use_step');
                    } else if (part.inlineData) {
                      // Handle image data
                      callback(JSON.stringify({
                        image_data: {
                          mime_type: part.inlineData.mimeType,
                          data: part.inlineData.data // This is base64 encoded image data
                        }
                      }), 'image_data');
                    }
                  }
                }
                
                // Send the finish reason if present
                if (candidate.finishReason && candidate.finishReason !== "FINISH_REASON_UNSPECIFIED") {
                  callback(JSON.stringify({ finish_reason: candidate.finishReason }), 'content_chunk');
                }
              } else if (parsed.promptFeedback) {
                // Handle feedback/error messages from the API
                const blockReason = parsed.promptFeedback.blockReason || "Unknown reason";
                const safetyRatings = parsed.promptFeedback.safetyRatings ? 
                  JSON.stringify(parsed.promptFeedback.safetyRatings) : "No details";
                callback(JSON.stringify({ 
                  error: `Gemini提示被拒绝: ${blockReason}`, 
                  details: safetyRatings 
                }), 'error_chunk');
              }
              
              // Remove the processed object from the buffer and update objStartIdx
              cleanBuffer = cleanBuffer.substring(objEndIdx + 1);
              objStartIdx = cleanBuffer.indexOf('{');
            } catch (e) {
              // If we can't parse it, move to the next potential object
              cleanBuffer = cleanBuffer.substring(objStartIdx + 1);
              objStartIdx = cleanBuffer.indexOf('{', 1);
            }
          } else {
            // No complete object found yet, wait for more data
            break;
          }
        }
        
        // Update the outer buffer with the remaining unprocessed content
        buffer = cleanBuffer;
      };
    } catch (error: any) {
      console.error('Gemini stream error (outer):', error);
      
      let errorMessage = 'Gemini API调用失败';
      let details = 'Failed to fetch or process stream from Gemini API.';
      
      if (error.message) {
        details = error.message;
        
        // Check for the "thinking is not supported" error and provide clearer message
        if (details.includes('thinking is not supported')) {
          errorMessage = 'Gemini API不支持thinking功能';
          details = '请在设置中选择不同的Gemini模型，或禁用thinking功能。';
        }
      }
      
      onData(JSON.stringify({ 
        error: errorMessage,
        details: details
      }), 'error_chunk');
      
      return reject(error);
    }
  });
}

// Placeholder for Grok API stream function
async function callGrokStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'image_data') => void,
  useAgent: boolean = false
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const apiKey = getApiKey('grok', req.apiKey);
    if (!apiKey) {
      onData(JSON.stringify({ error: 'Grok API密钥未设置。请在设置页面添加API密钥或检查环境变量。' }), 'error_chunk');
      return reject(new Error('Grok API key not set'));
    }

    // xAI Grok API endpoint (OpenAI-compatible format)
    const apiUrl = 'https://api.x.ai/v1/chat/completions';
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const messages = req.messages.map(m => ({ role: m.role, content: m.content }));

    const modelDetails = MODEL_MAPPING[req.model];
    const isReasoner = modelDetails?.isReasoner || false;
    const supportsThinking = modelDetails?.supports?.thinking || false;

    const bodyParams: any = {
      model: req.model_id, // e.g., 'grok-2'
      messages: messages,
      stream: true,
      max_tokens: req.max_tokens || 4096,
    };

    // 参数设置
    if (req.temperature !== undefined) bodyParams.temperature = req.temperature;
    if (req.top_p !== undefined) bodyParams.top_p = req.top_p;
    if (req.top_k !== undefined) bodyParams.top_k = req.top_k;
    if (req.presence_penalty !== undefined) bodyParams.presence_penalty = req.presence_penalty;
    if (req.frequency_penalty !== undefined) bodyParams.frequency_penalty = req.frequency_penalty;
    if (req.seed !== undefined) bodyParams.seed = req.seed;
    
    // Enable thinking for reasoning models
    if (supportsThinking && req.thinking?.budget_tokens) {
      bodyParams.thinking = { budget_tokens: req.thinking.budget_tokens };
    }
    
    if (req.stop_sequences && req.stop_sequences.length > 0) {
      bodyParams.stop = req.stop_sequences.slice(0, 4); // Grok API最多支持4个
    }

    // 工具调用支持
    if (req.tools && req.tools.length > 0) {
      bodyParams.tools = req.tools;
      if (req.tool_choice) {
        bodyParams.tool_choice = req.tool_choice;
      } else {
        bodyParams.tool_choice = "auto";
      }
    }

    const body = JSON.stringify(bodyParams);

    try {
      console.log('Grok API Request (placeholder):', {
        model: req.model_id,
        bodyLength: body.length,
        useProxy: useAgent ? 'true' : 'false',
        messages: messages.length
      });

      let fetchOptions: any = {
        method: 'POST',
        headers: headers,
        body: body,
      };

      if (useAgent && useProxy) {
        const hpAgent = new HpHttpsProxyAgent({
          proxy: PROXY_URL,
          timeout: API_TIMEOUT_MS,
        });
        fetchOptions.agent = hpAgent;
        console.log('Grok API使用代理 (HpHttpsProxyAgent)');
      }

      const timeout = API_TIMEOUT_MS;
      let fetchPromise = fetch(apiUrl, fetchOptions);
      const timeoutPromise = new Promise<any>((_, rejectTimeout) => {
        setTimeout(() => rejectTimeout(new Error(`Request timeout after ${timeout}ms`)), timeout);
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Grok API HTTP error: ${response.status} ${response.statusText}`, errorBody);
        const errorMsg = `Grok API Error: ${response.status} ${response.statusText} - ${errorBody}`;
        onData(JSON.stringify({ error: errorMsg }), 'error_chunk');
        return reject(new Error(errorMsg));
      }

      if (!response.body) {
        onData(JSON.stringify({ error: `Grok API Error [${req.model_id}]: 响应中没有数据流` }), 'error_chunk');
        return reject(new Error('No response body from Grok API'));
      }

      const reader = response.body;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedToolCallDeltas: { [key: number]: { id?: string, name?: string, arguments?: string } } = {};


      reader.on('data', (chunk: Buffer) => {
        const text = decoder.decode(chunk, { stream: true });
        buffer += text;
        let lineEndIndex;
        while ((lineEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const line = buffer.substring(0, lineEndIndex);
          buffer = buffer.substring(lineEndIndex + 2);
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();
            if (data === '[DONE]') {
              for (const index in accumulatedToolCallDeltas) {
                const toolCall = accumulatedToolCallDeltas[index];
                if (toolCall.id && toolCall.name && toolCall.arguments) {
                  try {
                    const parsedArgs = JSON.parse(toolCall.arguments);
                    onData(JSON.stringify({ 
                      tool_call_id: toolCall.id, 
                      tool_name: toolCall.name, 
                      tool_arguments: parsedArgs 
                    }), 'tool_use_step');
                  } catch(e) {
                     onData(JSON.stringify({ 
                      tool_call_id: toolCall.id, 
                      tool_name: toolCall.name, 
                      tool_arguments_raw: toolCall.arguments 
                    }), 'tool_use_step');
                  }
                }
              }
              accumulatedToolCallDeltas = {};
              onData(JSON.stringify({ finish_reason: 'stop' }), 'content_chunk');
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0].delta) {
                const delta = parsed.choices[0].delta;
                if (delta.content) {
                  onData(JSON.stringify({ content: delta.content }), 'content_chunk');
                }
                
                // Handle thinking content for Grok reasoning models
                if (isReasoner && delta.reasoning_content) {
                  onData(JSON.stringify({ reasoning_content: delta.reasoning_content }), 'thinking_step');
                }
                if (delta.tool_calls) {
                  for (const toolCallDelta of delta.tool_calls) {
                    const index = toolCallDelta.index;
                    if (!accumulatedToolCallDeltas[index]) {
                      accumulatedToolCallDeltas[index] = { arguments: '' };
                    }
                    if (toolCallDelta.id) accumulatedToolCallDeltas[index].id = toolCallDelta.id;
                    if (toolCallDelta.function?.name) accumulatedToolCallDeltas[index].name = toolCallDelta.function.name;
                    if (toolCallDelta.function?.arguments) accumulatedToolCallDeltas[index].arguments += toolCallDelta.function.arguments;
                  }
                }
                if (parsed.choices[0].finish_reason) {
                  for (const index in accumulatedToolCallDeltas) {
                    const toolCall = accumulatedToolCallDeltas[index];
                    if (toolCall.id && toolCall.name && toolCall.arguments) {
                       try {
                        const parsedArgs = JSON.parse(toolCall.arguments);
                        onData(JSON.stringify({ 
                          tool_call_id: toolCall.id, 
                          tool_name: toolCall.name, 
                          tool_arguments: parsedArgs 
                        }), 'tool_use_step');
                      } catch(e) {
                        onData(JSON.stringify({ 
                          tool_call_id: toolCall.id, 
                          tool_name: toolCall.name, 
                          tool_arguments_raw: toolCall.arguments 
                        }), 'tool_use_step');
                      }
                    }
                  }
                  accumulatedToolCallDeltas = {}; 
                  onData(JSON.stringify({ finish_reason: parsed.choices[0].finish_reason }), 'content_chunk');
                }
              }
            } catch (e) {
              console.error('Error parsing Grok JSON (placeholder):', data, e);
              if (data.includes('error')) {
                try {
                  const errorObj = JSON.parse(data);
                  onData(JSON.stringify({ error: 'Grok API错误', details: errorObj.error?.message || '未知错误' }), 'error_chunk');
                } catch (parseErr) { /* Do nothing */ }
              }
            }
          }
        }
      });

      reader.on('end', () => {
        console.log('Grok stream ended (placeholder)');
        if (buffer.length > 0 && buffer.startsWith('data: ')) {
          try {
            const data = buffer.substring(6).trim();
            if (data !== '[DONE]') {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                onData(JSON.stringify({ content: parsed.choices[0].delta.content }), 'content_chunk');
              }
            }
          } catch (e) { /* Ignore final buffer parse errors */ }
        }
        resolve();
      });

      reader.on('error', (err: any) => {
        console.error('Grok stream error (placeholder):', err);
        onData(JSON.stringify({ error: err.message || 'Stream error', details: err.code || 'Unknown error code' }), 'error_chunk');
        reject(err);
      });

    } catch (error: any) {
      console.error('Grok stream error (outer placeholder):', error);
      onData(JSON.stringify({ error: error.message || 'Grok API调用失败 (placeholder)', details: error.stack }), 'error_chunk');
      reject(error);
    }
  });
}

// Anthropic Claude implementation
async function callClaudeStream(
  req: LLMRequest, 
  onData: (chunk: string, stepType?: 'thinking_step' | 'tool_use_step' | 'content_chunk' | 'error_chunk' | 'image_data') => void,
  useAgentForRequest: boolean
): Promise<void> {
  const apiKey = getApiKey('claude', req.apiKey);
  if (!apiKey) {
    onData(JSON.stringify({ error: 'Anthropic API密钥未设置。请在设置页面添加API密钥。' }), 'error_chunk');
    return;
  }

  const modelDetails = MODEL_MAPPING[req.model];
  const supportsThinking = modelDetails?.supports?.thinking || false;
  
  const systemPrompt = req.messages.find(m => m.role === 'system')?.content as string | undefined;
  const userAssistantMessages = req.messages.filter(m => m.role === 'user' || m.role === 'assistant');

  const claudeModelId = req.model_id;

  const headers: any = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  };

  // Claude 4 models需要特殊的beta头
  const isClande4 = claudeModelId.includes('claude-opus-4') || claudeModelId.includes('claude-sonnet-4');
  
  if (isClande4) {
    // Claude 4 特殊处理
    if (supportsThinking) {
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    } else {
      headers['anthropic-beta'] = 'tools-2024-05-16';
    }
  } else {
    // Claude 3.x 标准处理 - also support thinking for 3.5 models
    if (supportsThinking) {
      headers['anthropic-beta'] = 'thinking-2024-12-19,tools-2024-05-16';
    } else {
    headers['anthropic-beta'] = 'tools-2024-05-16';
    }
  } 

  const bodyParams: any = {
    model: claudeModelId,
    messages: userAssistantMessages,
    stream: true,
    max_tokens: req.max_tokens || 8192, // Claude 4 models支持更多tokens
  };

  // 系统提示词设置
  let finalSystemPrompt = systemPrompt;
  if (req.system && req.system.trim()) {
    finalSystemPrompt = req.system;
  }
  if (finalSystemPrompt) {
    bodyParams.system = finalSystemPrompt;
  }

  // 参数设置
  if (req.temperature !== undefined) bodyParams.temperature = req.temperature;
  if (req.top_p !== undefined) bodyParams.top_p = req.top_p;
  if (req.top_k !== undefined) bodyParams.top_k = req.top_k;
  
  if (req.stop_sequences && req.stop_sequences.length > 0) {
    bodyParams.stop_sequences = req.stop_sequences.slice(0, 5); // Claude最多支持5个
  }

  // Thinking设置（Claude models）
  if (supportsThinking) {
    if (req.thinking?.budget_tokens) {
    bodyParams.thinking = { budget_tokens: req.thinking.budget_tokens };
    } else {
      // Enable thinking with default settings
      bodyParams.thinking = {};
    }
  }

  // 工具调用支持
  if (req.tools && req.tools.length > 0) {
    bodyParams.tools = req.tools;
    if (req.tool_choice) {
      bodyParams.tool_choice = req.tool_choice;
    }
  }

  const body = JSON.stringify(bodyParams);
  let inThinkingTag = false; // DECLARED AT FUNCTION SCOPE
  let currentToolCallInfo: { id: string, name: string, input: string } | null = null; // Also ensure this is at function scope if used in catch

  try {
    const apiUrl = 'https://api.anthropic.com/v1/messages';
    const fetchUrl = apiUrl;
    
    const response = await axios.post(fetchUrl, body, {
      headers,
      httpsAgent: useAgentForRequest ? httpsProxyAgent : undefined,
      timeout: API_TIMEOUT_MS,
      responseType: 'stream'
    });

    if (!response.data) {
      console.error('Claude API Error: No data in response');
      onData(JSON.stringify({ error: `Claude API Error: No data in response` }), 'error_chunk');
      return;
    }
    
    const stream = response.data;
    const decoder = new TextDecoder('utf-8');
    let accumulatedBuffer = '';

    stream.on('data', (chunk: Buffer) => {
      accumulatedBuffer += decoder.decode(chunk);
      let eventBoundary;
      
      while ((eventBoundary = accumulatedBuffer.indexOf('\n\n')) !== -1) {
        const eventData = accumulatedBuffer.substring(0, eventBoundary);
        accumulatedBuffer = accumulatedBuffer.substring(eventBoundary + 2);
        
        if (eventData.startsWith('event: ')) {
          const lines = eventData.split('\n');
          const eventTypeLine = lines.find(l => l.startsWith('event: '));
          const dataLine = lines.find(l => l.startsWith('data: '));

          if (eventTypeLine && dataLine) {
            const eventType = eventTypeLine.substring(7).trim();
            const jsonData = dataLine.substring(6).trim();
            try {
              const parsed = JSON.parse(jsonData);

              if (eventType === 'content_block_start') {
                 if (parsed.content_block?.type === 'tool_use') {
                  currentToolCallInfo = { 
                    id: parsed.content_block.id, 
                    name: parsed.content_block.name, 
                    input: '' 
                  };
                }
              } else if (eventType === 'thinking_delta') {
                // Handle Claude thinking content
                if (parsed.delta?.text) {
                  onData(JSON.stringify({ content: parsed.delta.text }), 'thinking_step');
                }
              } else if (eventType === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  let text = parsed.delta.text;
                  // Handle <thinking>...</thinking> tags within text_delta
                  let thinkingContent = '';
                  let regularContent = '';

                  while(text && text.length > 0) {
                      if (inThinkingTag) {
                          const endTagIndex = text.indexOf('</thinking>');
                          if (endTagIndex !== -1) {
                              thinkingContent = text.substring(0, endTagIndex);
                              if (thinkingContent) onData(JSON.stringify({ content: thinkingContent }), 'thinking_step');
                              text = text.substring(endTagIndex + '</thinking>'.length);
                              inThinkingTag = false;
                          } else {
                              if (text) onData(JSON.stringify({ content: text }), 'thinking_step');
                              text = ''; // Consumed whole chunk
                          }
                      } else {
                          const startTagIndex = text.indexOf('<thinking>');
                          if (startTagIndex !== -1) {
                              regularContent = text.substring(0, startTagIndex);
                              if (regularContent) onData(JSON.stringify({ content: regularContent }), 'content_chunk');
                              text = text.substring(startTagIndex + '<thinking>'.length);
                              inThinkingTag = true;
                          } else {
                              if (text) onData(JSON.stringify({ content: text }), 'content_chunk');
                              text = ''; // Consumed whole chunk
                          }
                      }
                  }
                } else if (parsed.delta?.type === 'input_json_delta') {
                  if (currentToolCallInfo && parsed.delta.partial_json) {
                    currentToolCallInfo.input += parsed.delta.partial_json;
                  }
                }
              } else if (eventType === 'content_block_stop') {
                if (currentToolCallInfo) {
                  try {
                    const parsedInput = JSON.parse(currentToolCallInfo.input); 
                    // If it's our special reasoning tool, send its input as 'thinking_step'
                    if (currentToolCallInfo.name === 'log_reasoning_step' && parsedInput.thought_or_code) {
                        onData(JSON.stringify({ content: parsedInput.thought_or_code }), 'thinking_step');
                    } else {
                        // Standard tool use
                        onData(JSON.stringify({ 
                            tool_id: currentToolCallInfo.id, 
                            tool_name: currentToolCallInfo.name, 
                            tool_input: parsedInput 
                        }), 'tool_use_step');
                    }
                  } catch (e) {
                     console.error("Error parsing accumulated Claude tool input JSON", currentToolCallInfo.input, e);
                     onData(JSON.stringify({ 
                        tool_id: currentToolCallInfo.id, 
                        tool_name: currentToolCallInfo.name, 
                        tool_input_raw: currentToolCallInfo.input 
                      }), 'tool_use_step');
                  }
                  currentToolCallInfo = null; 
                }
              } else if (eventType === 'message_delta') {
                if (parsed.delta?.stop_reason) {
                   onData(JSON.stringify({ finish_reason: parsed.delta.stop_reason, usage: parsed.usage }), 'content_chunk');
                }
              } else if (eventType === 'message_stop') {
                // If we were in a thinking tag that wasn't closed, ensure inThinkingTag is reset
                if (inThinkingTag) inThinkingTag = false;
                return; 
              }
            } catch (e) {
              console.error('Error parsing Claude JSON or handling event:', eventType, jsonData, e);
              onData(JSON.stringify({ error: 'Error parsing Claude stream data', details: jsonData }), 'error_chunk');
            }
          }
        }
      }
    });
    
    stream.on('end', () => {
      console.log('Claude stream ended');
      // Final check for unclosed thinking tag
      if (inThinkingTag) inThinkingTag = false;
    });
    
    stream.on('error', (err: any) => {
      console.error('Claude stream error:', err);
      onData(JSON.stringify({ error: err.message || 'Stream error' }), 'error_chunk');
      // Ensure inThinkingTag is reset on error too
      if (inThinkingTag) inThinkingTag = false;
    });
  } catch (error: any) {
    console.error('Claude stream error:', error);
    onData(JSON.stringify({ error: error.message || 'Failed to fetch from Claude API' }), 'error_chunk');
     // Ensure inThinkingTag is reset on error too
    if (inThinkingTag) inThinkingTag = false;
  }
}
