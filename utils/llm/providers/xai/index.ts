// utils/llm/providers/xai/index.ts
// xAI Grok提供商实现

import axios from 'axios';
import { BaseLLMProvider } from '../../core/base-provider';
import { LLMRequest, LLMResponse, StreamCallback, ModelConfig, LLMProvider } from '../../core/types';
import { proxyManager } from '../../../network/proxy';
import { XAI_MODELS } from './models';

export class XAIProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://api.x.ai/v1';

  constructor(apiKey?: string) {
    super(LLMProvider.XAI, 'xAI Grok', apiKey);
  }

  getModels(): Record<string, ModelConfig> {
    return XAI_MODELS;
  }

  getDefaultApiKey(): string {
    return process.env.XAI_API_KEY || '';
  }

  protected getApiEndpoint(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected getImageGenerationEndpoint(): string {
    return `${this.baseUrl}/images/generations`;
  }

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  validateAndCleanRequest(request: LLMRequest): LLMRequest {
    const modelInfo = this.getModelInfo(request.model);
    if (!modelInfo?.supports) {
      return request;
    }

    const cleaned = { ...request };
    const supports = modelInfo.supports;

    // 验证并清理参数
    cleaned.temperature = this.validateParameter(cleaned.temperature, supports.temperature);
    cleaned.top_p = this.validateParameter(cleaned.top_p, supports.top_p);
    cleaned.max_tokens = this.validateParameter(cleaned.max_tokens, supports.max_tokens);

    // 清理不支持的参数
    if (!supports.tools) {
      delete cleaned.tools;
      delete cleaned.tool_choice;
    }

    if (!supports.reasoning) {
      delete cleaned.reasoning_effort;
    }

    if (!supports.search) {
      delete cleaned.search_parameters;
    }

    if (!supports.vision) {
      // 清理图像内容（针对非视觉模型）
      cleaned.messages = cleaned.messages.map(msg => {
        if (Array.isArray(msg.content)) {
          msg.content = msg.content.filter(part => part.type === 'text');
        }
        return msg;
      });
    }

    // 限制stop_sequences数量
    if (cleaned.stop_sequences && supports.stop_sequences) {
      cleaned.stop_sequences = cleaned.stop_sequences.slice(0, supports.stop_sequences.max_count);
    }

    return cleaned;
  }

  async callStream(request: LLMRequest, onData: StreamCallback): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const apiKey = request.apiKey || this.getDefaultApiKey();
        if (!apiKey) {
          return reject(new Error('xAI API密钥未配置'));
        }

        const modelInfo = this.getModelInfo(request.model);
        const isImageGeneration = this.isImageGenerationModel(request.model);

        if (isImageGeneration) {
          return reject(new Error('图像生成模型不支持流式响应'));
        }

        // 构建请求体（OpenAI兼容格式）
        const bodyParams = this.buildChatRequest(request, modelInfo);

        this.debugLog('Stream Request', {
          model: request.model,
          isReasoner: modelInfo?.isReasoner,
          hasTools: !!request.tools?.length,
          hasSearch: !!request.search_parameters,
          endpoint: 'chat/completions'
        });

        const axiosConfig = proxyManager.getAxiosConfig({
          method: 'POST',
          url: this.getApiEndpoint(),
          headers: this.getHeaders(apiKey),
          data: bodyParams,
          responseType: 'stream'
        });

        const response = await axios.request(axiosConfig);

        if (response.status !== 200) {
          throw new Error(`xAI API Error: ${response.status} - ${response.statusText}`);
        }

        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          buffer += text;

          let lineEndIndex;
          while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex);
            buffer = buffer.substring(lineEndIndex + 1);

            if (line.trim() && line.startsWith('data: ')) {
              const data = line.substring(6).trim();
              
              if (data === '[DONE]') {
                onData(JSON.stringify({ finish_reason: 'stop' }), 'done');
                resolve();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                this.processStreamChunk(parsed, modelInfo?.isReasoner || false, onData);
              } catch (e) {
                this.debugLog('Parse Error', `Failed to parse: ${data}`);
              }
            }
          }
        });

        response.data.on('error', (error: any) => {
          reject(this.handleError(error, 'stream'));
        });

        response.data.on('end', () => {
          if (buffer.trim()) {
            onData(JSON.stringify({ finish_reason: 'stop' }), 'done');
          }
          resolve();
        });

      } catch (error) {
        reject(this.handleError(error, 'callStream'));
      }
    });
  }

  async callNonStream(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = request.apiKey || this.getDefaultApiKey();
    if (!apiKey) {
      throw new Error('xAI API密钥未配置');
    }

    const modelInfo = this.getModelInfo(request.model);
    const isImageGeneration = this.isImageGenerationModel(request.model);

    if (isImageGeneration) {
      return this.handleImageGeneration(request, apiKey);
    }

    // 构建聊天请求
    const bodyParams = this.buildChatRequest(request, modelInfo);

    const axiosConfig = proxyManager.getAxiosConfig({
      method: 'POST',
      url: this.getApiEndpoint(),
      headers: this.getHeaders(apiKey),
      data: bodyParams
    });

    const response = await axios.request(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`xAI API Error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
    }

    const result = response.data;
    const choice = result.choices?.[0];
    
    if (!choice) {
      throw new Error('No valid response from xAI API');
    }

    // 处理响应内容
    let content = choice.message?.content || '';
    let reasoning_content = choice.message?.reasoning_content;
    const toolCalls = choice.message?.tool_calls;

    return {
      content: content,
      thinking: reasoning_content || undefined,
      tool_calls: toolCalls || undefined,
      finish_reason: choice.finish_reason || undefined,
      usage: result.usage ? {
        prompt_tokens: result.usage.prompt_tokens || 0,
        completion_tokens: result.usage.completion_tokens || 0,
        total_tokens: result.usage.total_tokens || 0,
        reasoning_tokens: result.usage.completion_tokens_details?.reasoning_tokens || undefined
      } : undefined
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const apiKey = this.getDefaultApiKey();
      if (!apiKey) return false;

      // 使用简单的聊天请求来检查连接
      const axiosConfig = proxyManager.getAxiosConfig({
        method: 'POST',
        url: this.getApiEndpoint(),
        headers: this.getHeaders(apiKey),
        data: {
          model: 'grok-3-mini',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        },
        timeout: 5000
      });

      const response = await axios.request(axiosConfig);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 构建聊天请求体
   */
  private buildChatRequest(request: LLMRequest, modelInfo?: ModelConfig): any {
    const bodyParams: any = {
      model: request.model_id || modelInfo?.apiModel || request.model,
      messages: request.messages,
      stream: request.stream || false
    };

    // 基础参数
    if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
    if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
    if (request.max_tokens !== undefined) bodyParams.max_tokens = request.max_tokens;
    if (request.stop_sequences?.length) bodyParams.stop = request.stop_sequences;

    // 推理努力控制（仅支持推理模型）
    if (modelInfo?.isReasoner && request.reasoning_effort) {
      bodyParams.reasoning_effort = request.reasoning_effort;
    }

    // 实时搜索参数
    if (request.search_parameters && modelInfo?.supports?.search) {
      bodyParams.search_parameters = request.search_parameters;
    }

    // 工具调用
    if (request.tools?.length && modelInfo?.supports?.tools) {
      bodyParams.tools = request.tools;
      if (request.tool_choice) {
        bodyParams.tool_choice = request.tool_choice;
      }
    }

    // 响应格式（结构化输出）
    if (request.response_format && modelInfo?.supports?.structured_output) {
      bodyParams.response_format = request.response_format;
    }

    return bodyParams;
  }

  /**
   * 处理图像生成
   */
  private async handleImageGeneration(request: LLMRequest, apiKey: string): Promise<LLMResponse> {
    const prompt = request.prompt || (typeof request.messages[0]?.content === 'string' ? request.messages[0].content : '');
    
    if (!prompt) {
      throw new Error('图像生成需要提供 prompt 参数');
    }

    const bodyParams: any = {
      model: request.model,
      prompt: prompt
    };

    if (request.n) bodyParams.n = Math.min(request.n, 10); // 最大10张
    if (request.response_format_image) bodyParams.response_format = request.response_format_image;

    const axiosConfig = proxyManager.getAxiosConfig({
      method: 'POST',
      url: this.getImageGenerationEndpoint(),
      headers: this.getHeaders(apiKey),
      data: bodyParams
    });

    const response = await axios.request(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`xAI Image API Error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
    }

    const result = response.data;
    const images = result.data || [];

    // 构建图像响应内容
    let content = `生成了 ${images.length} 张图片:\n`;
    images.forEach((img: any, index: number) => {
      if (img.url) {
        content += `图片 ${index + 1}: ${img.url}\n`;
      } else if (img.b64_json) {
        content += `图片 ${index + 1}: [Base64数据]\n`;
      }
      if (img.revised_prompt) {
        content += `修订提示: ${img.revised_prompt}\n`;
      }
    });

    return {
      content: content.trim(),
      images: images,
      finish_reason: 'stop'
    };
  }

  /**
   * 检查是否为图像生成模型
   */
  private isImageGenerationModel(model: string): boolean {
    return model.includes('image') || model.includes('grok-2-image');
  }

  /**
   * 处理流式数据块
   */
  private processStreamChunk(parsed: any, isReasoner: boolean, onData: StreamCallback): void {
    const choice = parsed.choices?.[0];
    if (!choice) return;

    const delta = choice.delta;
    if (!delta) return;

    // 常规内容
    if (delta.content) {
      onData(JSON.stringify({ content: delta.content }), 'content_chunk');
    }

    // 推理内容（Grok特有）
    if (delta.reasoning_content) {
      onData(JSON.stringify({ thinking: delta.reasoning_content }), 'thinking_step');
    }

    // 工具调用
    if (delta.tool_calls) {
      delta.tool_calls.forEach((toolCall: any) => {
        onData(JSON.stringify({
          tool_call_id: toolCall.id,
          tool_name: toolCall.function?.name,
          tool_arguments: toolCall.function?.arguments
        }), 'tool_use_step');
      });
    }

    // 完成原因
    if (choice.finish_reason) {
      onData(JSON.stringify({ finish_reason: choice.finish_reason }), 'done');
    }
  }
} 