// utils/llm/index.ts
// LLM模块统一导出入口

import { 
  LLMRequest, 
  LLMResponse, 
  StreamCallback, 
  ModelConfig, 
  LLMProvider 
} from './core/types';
import { 
  providerFactory, 
  createLLMProvider, 
  getProviderByModel, 
  getAllAvailableModels,
  getAvailableModelNames,
  modelSupports,
  getReasoningModels,
  getVisionModels,
  getToolModels
} from './factory';

// 导出核心类型
export * from './core/types';
export * from './core/base-provider';
export * from './factory';

// 导出网络相关
export { proxyManager } from '../network/proxy';

/**
 * 新的流式API调用函数 - 替代原有的callLLMStream
 */
export async function callLLMStream(request: LLMRequest, onData: StreamCallback): Promise<void> {
  const providerType = getProviderByModel(request.model);
  
  if (!providerType) {
    throw new Error(`Unsupported model: ${request.model}`);
  }

  const provider = createLLMProvider(providerType, request.apiKey);
  const cleanedRequest = provider.validateAndCleanRequest(request);
  
  return provider.callStream(cleanedRequest, onData);
}

/**
 * 新的非流式API调用函数
 */
export async function callLLMNonStream(request: LLMRequest): Promise<LLMResponse> {
  const providerType = getProviderByModel(request.model);
  
  if (!providerType) {
    throw new Error(`Unsupported model: ${request.model}`);
  }

  const provider = createLLMProvider(providerType, request.apiKey);
  const cleanedRequest = provider.validateAndCleanRequest(request);
  
  return provider.callNonStream(cleanedRequest);
}

/**
 * 获取模型映射 - 为了向后兼容
 */
export function getModelMapping(): Record<string, { 
  provider: string; 
  apiModel: string; 
  isReasoner?: boolean;
  supports?: any;
}> {
  const models = getAllAvailableModels();
  const mapping: Record<string, { 
    provider: string; 
    apiModel: string; 
    isReasoner?: boolean;
    supports?: any;
  }> = {};
  
  for (const [modelName, config] of Object.entries(models)) {
    mapping[modelName] = {
      provider: config.provider.toString(),
      apiModel: config.apiModel,
      isReasoner: config.isReasoner,
      supports: config.supports
    };
  }
  
  return mapping;
}

/**
 * 检查模型是否为推理模型 - 为了向后兼容
 */
export function isReasoningModel(modelName: string): boolean {
  const modelInfo = getModelInfo(modelName);
  return modelInfo?.isReasoner || false;
}

/**
 * 检查模型是否支持工具调用
 */
export function modelSupportsTools(modelName: string): boolean {
  const modelInfo = getModelInfo(modelName);
  return !!modelInfo?.supports?.tools;
}

/**
 * 检查模型是否支持视觉
 */
export function modelSupportsVision(modelName: string): boolean {
  const modelInfo = getModelInfo(modelName);
  return !!modelInfo?.supports?.vision;
}

/**
 * 获取提供商信息
 */
export function getProviderInfo(): {
  available: LLMProvider[];
  models: Record<string, ModelConfig>;
  stats: Record<string, { modelCount: number; available: boolean }>;
} {
  return {
    available: providerFactory.getAvailableProviders(),
    models: getAllAvailableModels(),
    stats: providerFactory.getProviderStats()
  };
}

/**
 * 获取模型的详细配置信息
 */
export function getModelInfo(modelName: string): ModelConfig | undefined {
  const models = getAllAvailableModels();
  return models[modelName];
}

/**
 * 按提供商分组获取模型
 */
export function getModelsByProvider(): Record<string, string[]> {
  const models = getAllAvailableModels();
  const grouped: Record<string, string[]> = {};
  
  for (const [modelName, config] of Object.entries(models)) {
    const provider = config.provider;
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(modelName);
  }
  
  return grouped;
}

/**
 * 获取推荐的模型列表（按用途分类）
 */
export function getRecommendedModels(): {
  reasoning: string[];
  general: string[];
  vision: string[];
  tools: string[];
  costEffective: string[];
} {
  const models = getAllAvailableModels();
  const result = {
    reasoning: [] as string[],
    general: [] as string[],
    vision: [] as string[],
    tools: [] as string[],
    costEffective: [] as string[]
  };

  for (const [modelName, config] of Object.entries(models)) {
    // 推理模型
    if (config.isReasoner) {
      result.reasoning.push(modelName);
    }
    
    // 视觉模型
    if (config.supports?.vision) {
      result.vision.push(modelName);
    }
    
    // 工具调用模型
    if (config.supports?.tools) {
      result.tools.push(modelName);
    }
    
    // 性价比模型（mini/small模型）
    if (modelName.includes('mini') || modelName.includes('small')) {
      result.costEffective.push(modelName);
    }
    
    // 通用模型（旗舰模型）
    if (modelName.includes('4.1') || modelName.includes('v3') || 
        (modelName.includes('4o') && !modelName.includes('mini'))) {
      result.general.push(modelName);
    }
  }

  return result;
}

/**
 * 检查模型参数是否在支持范围内
 */
export function validateModelParameter(
  modelName: string, 
  paramName: string, 
  value: number
): { valid: boolean; adjusted?: number; error?: string } {
  const modelInfo = getModelInfo(modelName);
  if (!modelInfo?.supports) {
    return { valid: true }; // 如果没有限制信息，认为有效
  }

  const paramConfig = (modelInfo.supports as any)[paramName];
  if (!paramConfig || typeof paramConfig !== 'object') {
    return { valid: true };
  }

  if (value < paramConfig.min) {
    return {
      valid: false,
      adjusted: paramConfig.min,
      error: `${paramName} must be >= ${paramConfig.min}, got ${value}`
    };
  }

  if (value > paramConfig.max) {
    return {
      valid: false,
      adjusted: paramConfig.max,
      error: `${paramName} must be <= ${paramConfig.max}, got ${value}`
    };
  }

  return { valid: true };
}

/**
 * 获取模型的默认参数值
 */
export function getModelDefaults(modelName: string): Record<string, any> {
  const modelInfo = getModelInfo(modelName);
  if (!modelInfo?.supports) {
    return {};
  }

  const defaults: Record<string, any> = {};
  const supports = modelInfo.supports as any;

  for (const [param, config] of Object.entries(supports)) {
    if (config && typeof config === 'object' && 'default' in config) {
      defaults[param] = config.default;
    }
  }

  return defaults;
}

// 为了向后兼容，创建与原有API相似的导出
export const MODEL_MAPPING = getModelMapping();

// 简化的调用接口，与原有API保持兼容
export { callLLMStream as callLLM };

// 默认导出主要API
export default {
  callLLMStream,
  callLLMNonStream,
  getModelMapping,
  isReasoningModel,
  modelSupportsTools,
  modelSupportsVision,
  getProviderInfo,
  getRecommendedModels,
  getModelsByProvider,
  validateModelParameter,
  getModelDefaults
}; 