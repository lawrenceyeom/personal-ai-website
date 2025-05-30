// utils/llm/factory.ts
// LLM提供商工厂

import { BaseLLMProvider } from './core/base-provider';
import { LLMProvider, ModelConfig } from './core/types';
import { DeepSeekProvider } from './providers/deepseek';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { XAIProvider } from './providers/xai';
import { AnthropicProvider } from './providers/anthropic';

// 临时导入（待实现其他提供商时替换）
// import { AnthropicProvider } from './providers/anthropic';
// import { GoogleProvider } from './providers/google';
// import { XAIProvider } from './providers/xai';

export interface ProviderFactory {
  createProvider(provider: LLMProvider, apiKey?: string): BaseLLMProvider;
  getAvailableProviders(): LLMProvider[];
  getAllModels(): Record<string, ModelConfig>;
  getProviderByModel(modelName: string): LLMProvider | undefined;
}

class LLMProviderFactory implements ProviderFactory {
  private static instance: LLMProviderFactory;
  private providerCache: Map<string, BaseLLMProvider> = new Map();

  private constructor() {}

  public static getInstance(): LLMProviderFactory {
    if (!LLMProviderFactory.instance) {
      LLMProviderFactory.instance = new LLMProviderFactory();
    }
    return LLMProviderFactory.instance;
  }

  createProvider(provider: LLMProvider, apiKey?: string): BaseLLMProvider {
    const cacheKey = `${provider}_${apiKey || 'default'}`;
    
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    let providerInstance: BaseLLMProvider;

    switch (provider) {
      case LLMProvider.DEEPSEEK:
        providerInstance = new DeepSeekProvider(apiKey);
        break;
      
      case LLMProvider.OPENAI:
        providerInstance = new OpenAIProvider(apiKey);
        break;

      case LLMProvider.GOOGLE:
        providerInstance = new GeminiProvider(apiKey);
        break;

      case LLMProvider.XAI:
        providerInstance = new XAIProvider(apiKey);
        break;

      case LLMProvider.ANTHROPIC:
        providerInstance = new AnthropicProvider(apiKey);
        break;

      // case LLMProvider.COHERE:
      //   providerInstance = new CohereProvider(apiKey);
      //   break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    this.providerCache.set(cacheKey, providerInstance);
    return providerInstance;
  }

  getAvailableProviders(): LLMProvider[] {
    return [
      LLMProvider.DEEPSEEK,
      LLMProvider.OPENAI,
      LLMProvider.GOOGLE,
      LLMProvider.XAI,
      LLMProvider.ANTHROPIC,
      // LLMProvider.COHERE,
      // LLMProvider.MISTRAL,
    ];
  }

  getAllModels(): Record<string, ModelConfig> {
    const allModels: Record<string, ModelConfig> = {};
    
    // 合并所有提供商的模型
    const deepseekProvider = new DeepSeekProvider();
    Object.assign(allModels, deepseekProvider.getModels());
    
    const openaiProvider = new OpenAIProvider();
    Object.assign(allModels, openaiProvider.getModels());

    const geminiProvider = new GeminiProvider();
    Object.assign(allModels, geminiProvider.getModels());

    const xaiProvider = new XAIProvider();
    Object.assign(allModels, xaiProvider.getModels());

    const anthropicProvider = new AnthropicProvider();
    Object.assign(allModels, anthropicProvider.getModels());

    return allModels;
  }

  getProviderByModel(modelName: string): LLMProvider | undefined {
    const allModels = this.getAllModels();
    const modelConfig = allModels[modelName];
    return modelConfig?.provider;
  }

  /**
   * 清理缓存（用于测试或重置）
   */
  clearCache(): void {
    this.providerCache.clear();
  }

  /**
   * 检查提供商是否可用（是否有配置的API密钥）
   */
  async checkProviderAvailability(provider: LLMProvider): Promise<boolean> {
    try {
      const providerInstance = this.createProvider(provider);
      return await providerInstance.checkConnection();
    } catch {
      return false;
    }
  }

  /**
   * 获取提供商统计信息
   */
  getProviderStats(): Record<string, { modelCount: number; available: boolean }> {
    const stats: Record<string, { modelCount: number; available: boolean }> = {};
    
    for (const provider of this.getAvailableProviders()) {
      try {
        const providerInstance = this.createProvider(provider);
        const models = providerInstance.getModels();
        stats[provider] = {
          modelCount: Object.keys(models).length,
          available: !!providerInstance.getDefaultApiKey()
        };
      } catch {
        stats[provider] = {
          modelCount: 0,
          available: false
        };
      }
    }

    return stats;
  }
}

// 导出单例实例
export const providerFactory = LLMProviderFactory.getInstance();

// 便捷方法
export function createLLMProvider(provider: LLMProvider, apiKey?: string): BaseLLMProvider {
  return providerFactory.createProvider(provider, apiKey);
}

export function getProviderByModel(modelName: string): LLMProvider | undefined {
  return providerFactory.getProviderByModel(modelName);
}

export function getAllAvailableModels(): Record<string, ModelConfig> {
  return providerFactory.getAllModels();
}

/**
 * 获取所有支持的模型名称
 */
export function getAvailableModelNames(): string[] {
  return Object.keys(getAllAvailableModels());
}

/**
 * 检查模型是否支持特定功能
 */
export function modelSupports(modelName: string, feature: string): boolean {
  const models = getAllAvailableModels();
  const model = models[modelName];
  if (!model?.supports) return false;

  return !!(model.supports as any)[feature];
}

/**
 * 获取推理模型列表
 */
export function getReasoningModels(): string[] {
  const models = getAllAvailableModels();
  return Object.keys(models).filter(modelName => models[modelName].isReasoner);
}

/**
 * 获取支持视觉的模型列表
 */
export function getVisionModels(): string[] {
  const models = getAllAvailableModels();
  return Object.keys(models).filter(modelName => models[modelName].supports?.vision);
}

/**
 * 获取支持工具调用的模型列表
 */
export function getToolModels(): string[] {
  const models = getAllAvailableModels();
  return Object.keys(models).filter(modelName => models[modelName].supports?.tools);
} 