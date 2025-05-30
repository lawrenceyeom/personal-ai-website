// utils/llm/core/base-provider.ts
// LLM提供商基类定义

import { 
  LLMRequest, 
  LLMResponse, 
  StreamCallback, 
  ModelConfig, 
  LLMProvider 
} from './types';

export abstract class BaseLLMProvider {
  protected readonly provider: LLMProvider;
  protected readonly name: string;
  protected readonly apiKey?: string;

  constructor(provider: LLMProvider, name: string, apiKey?: string) {
    this.provider = provider;
    this.name = name;
    this.apiKey = apiKey;
  }

  /**
   * 获取提供商支持的模型配置
   */
  abstract getModels(): Record<string, ModelConfig>;

  /**
   * 获取默认API密钥
   */
  abstract getDefaultApiKey(): string;

  /**
   * 验证和清理请求参数
   */
  abstract validateAndCleanRequest(request: LLMRequest): LLMRequest;

  /**
   * 流式调用API
   */
  abstract callStream(
    request: LLMRequest, 
    onData: StreamCallback
  ): Promise<void>;

  /**
   * 非流式调用API
   */
  abstract callNonStream(request: LLMRequest): Promise<LLMResponse>;

  /**
   * 检查连接状态
   */
  abstract checkConnection(): Promise<boolean>;

  /**
   * 获取API端点
   */
  protected abstract getApiEndpoint(): string;

  /**
   * 获取请求头
   */
  protected abstract getHeaders(apiKey: string): Record<string, string>;

  /**
   * 处理错误响应
   */
  protected handleError(error: any, context: string): Error {
    const message = error?.response?.data?.error?.message || 
                   error?.message || 
                   `${this.name} API Error in ${context}`;
    
    console.error(`[${this.name.toUpperCase()}] Error in ${context}:`, error);
    return new Error(`${this.name}: ${message}`);
  }

  /**
   * 记录调试信息
   */
  protected debugLog(type: string, message: any): void {
    const logMessage = typeof message === 'object' 
      ? JSON.stringify(message) 
      : message;
    console.log(`[${this.name.toUpperCase()}-DEBUG] ${type}: ${logMessage}`);
  }

  /**
   * 获取模型信息
   */
  public getModelInfo(modelName: string): ModelConfig | undefined {
    const models = this.getModels();
    return models[modelName];
  }

  /**
   * 检查模型是否支持推理
   */
  public isReasoningModel(modelName: string): boolean {
    const modelInfo = this.getModelInfo(modelName);
    return modelInfo?.isReasoner || false;
  }

  /**
   * 检查模型是否支持工具调用
   */
  public supportsTools(modelName: string): boolean {
    const modelInfo = this.getModelInfo(modelName);
    return modelInfo?.supports?.tools || false;
  }

  /**
   * 检查模型是否支持视觉
   */
  public supportsVision(modelName: string): boolean {
    const modelInfo = this.getModelInfo(modelName);
    return modelInfo?.supports?.vision || false;
  }

  /**
   * 处理多模态内容
   */
  protected processMultimodalContent(content: any): any {
    if (Array.isArray(content)) {
      return content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        } else if (part.type === 'image_url' && part.image_url?.url) {
          return { 
            type: 'image_url', 
            image_url: { url: part.image_url.url } 
          };
        }
        return part;
      });
    }
    return content;
  }

  /**
   * 验证参数范围
   */
  protected validateParameter(
    value: number | undefined, 
    range: { min: number; max: number } | undefined
  ): number | undefined {
    if (value === undefined || !range) return value;
    return Math.max(range.min, Math.min(range.max, value));
  }
} 