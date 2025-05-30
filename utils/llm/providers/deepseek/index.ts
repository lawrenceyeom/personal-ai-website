// utils/llm/providers/deepseek/index.ts
// DeepSeek提供商实现

import fetch from 'node-fetch';
import { BaseLLMProvider } from '../../core/base-provider';
import { LLMRequest, LLMResponse, StreamCallback, ModelConfig, LLMProvider } from '../../core/types';
import { proxyManager } from '../../../network/proxy';
import { DEEPSEEK_MODELS } from './models';

export class DeepSeekProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://api.deepseek.com/v1';

  constructor(apiKey?: string) {
    super(LLMProvider.DEEPSEEK, 'DeepSeek', apiKey);
  }

  getModels(): Record<string, ModelConfig> {
    return DEEPSEEK_MODELS;
  }

  getDefaultApiKey(): string {
    return process.env.DEEPSEEK_API_KEY || '';
  }

  protected getApiEndpoint(): string {
    return `${this.baseUrl}/chat/completions`;
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
    const isReasoner = modelInfo.isReasoner;

    // 对于推理模型，某些参数不生效（但可以设置，不会报错）
    // 根据官方文档：temperature、top_p、presence_penalty、frequency_penalty 对推理模型不生效
    if (!isReasoner) {
      // 非推理模型正常验证参数
      cleaned.temperature = this.validateParameter(cleaned.temperature, supports.temperature);
      cleaned.top_p = this.validateParameter(cleaned.top_p, supports.top_p);
      cleaned.presence_penalty = this.validateParameter(cleaned.presence_penalty, supports.presence_penalty);
      cleaned.frequency_penalty = this.validateParameter(cleaned.frequency_penalty, supports.frequency_penalty);
    }
    // 推理模型保持这些参数（虽然不生效，但不会报错）

    cleaned.max_tokens = this.validateParameter(cleaned.max_tokens, supports.max_tokens);

    // 清理不支持的参数
    if (cleaned.stop_sequences && supports.stop_sequences) {
      cleaned.stop_sequences = cleaned.stop_sequences.slice(0, supports.stop_sequences.max_count);
    } else if (!supports.stop_sequences) {
      delete cleaned.stop_sequences;
    }

    // 推理模型不支持 logprobs 和 top_logprobs（会报错）
    if (isReasoner) {
      delete cleaned.logprobs;
      delete cleaned.top_logprobs;
    }

    // 工具调用支持
    if (cleaned.tools && !supports.tools) {
      delete cleaned.tools;
      delete cleaned.tool_choice;
    }

    return cleaned;
  }

  async callStream(request: LLMRequest, onData: StreamCallback): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const apiKey = request.apiKey || this.getDefaultApiKey();
        if (!apiKey) {
          return reject(new Error('DeepSeek API密钥未配置'));
        }

        const modelInfo = this.getModelInfo(request.model);
        const isReasoner = modelInfo?.isReasoner || false;

        // 构建请求体
        const messages = request.messages.map(m => ({
          role: m.role,
          content: this.processMultimodalContent(m.content)
        }));

        const bodyParams: any = {
          model: request.model_id || request.model,
          messages: messages,
          stream: true,
          max_tokens: request.max_tokens || 4096
        };

        // 添加支持的参数
        if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
        if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
        if (request.presence_penalty !== undefined) bodyParams.presence_penalty = request.presence_penalty;
        if (request.frequency_penalty !== undefined) bodyParams.frequency_penalty = request.frequency_penalty;
        if (request.seed !== undefined) bodyParams.seed = request.seed;

        // 推理模型的thinking配置
        if (isReasoner && request.thinking?.budget_tokens) {
          // 根据官方文档，推理模型使用 reasoning 参数而不是 thinking
          bodyParams.reasoning = { max_tokens: request.thinking.budget_tokens };
        }

        // JSON输出模式
        if (request.response_format?.type === 'json_object') {
          bodyParams.response_format = { type: 'json_object' };
        }

        // stop序列
        if (request.stop_sequences?.length) {
          bodyParams.stop = request.stop_sequences.slice(0, 4);
        }

        // 工具调用
        if (request.tools?.length) {
          bodyParams.tools = request.tools;
          bodyParams.tool_choice = request.tool_choice || 'auto';
        }

        // logprobs 支持（仅非推理模型）
        if (!isReasoner) {
          if (request.logprobs !== undefined) bodyParams.logprobs = request.logprobs;
          if (request.top_logprobs !== undefined) bodyParams.top_logprobs = request.top_logprobs;
        }

        this.debugLog('Request', {
          model: request.model,
          messagesCount: messages.length,
          isReasoner,
          hasTools: !!request.tools?.length
        });

        const fetchConfig = proxyManager.getFetchConfig({
          method: 'POST',
          headers: this.getHeaders(apiKey),
          body: JSON.stringify(bodyParams)
        });

        const response = await fetch(this.getApiEndpoint(), fetchConfig);

        if (!response.ok) {
          const errorBody = await response.text();
          this.debugLog('Error', `HTTP ${response.status}: ${errorBody}`);
          throw new Error(`DeepSeek API Error: ${response.status} - ${errorBody}`);
        }

        if (!response.body) {
          throw new Error('No response body from DeepSeek API');
        }

        const reader = response.body;
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let accumulatedToolCalls: { [key: number]: any } = {};

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
                this.handleStreamComplete(accumulatedToolCalls, onData);
                resolve();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                this.processStreamChunk(parsed, isReasoner, accumulatedToolCalls, onData);
              } catch (e) {
                this.debugLog('Parse Error', `Failed to parse: ${data}`);
              }
            }
          }
        });

        reader.on('error', (error) => {
          reject(this.handleError(error, 'stream'));
        });

        reader.on('end', () => {
          this.handleStreamComplete(accumulatedToolCalls, onData);
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
      throw new Error('DeepSeek API密钥未配置');
    }

    const modelInfo = this.getModelInfo(request.model);
    const isReasoner = modelInfo?.isReasoner || false;

    // 构建非流式请求
    const messages = request.messages.map(m => ({
      role: m.role,
      content: this.processMultimodalContent(m.content)
    }));

    const bodyParams: any = {
      model: request.model_id || request.model,
      messages: messages,
      stream: false,
      max_tokens: request.max_tokens || (isReasoner ? 32768 : 4096)
    };

    // 添加参数（推理模型的某些参数不生效但可以设置）
    if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
    if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
    if (request.presence_penalty !== undefined) bodyParams.presence_penalty = request.presence_penalty;
    if (request.frequency_penalty !== undefined) bodyParams.frequency_penalty = request.frequency_penalty;

    // 推理模型特殊配置
    if (isReasoner && request.thinking?.budget_tokens) {
      bodyParams.reasoning = { max_tokens: request.thinking.budget_tokens };
    }

    // JSON输出模式
    if (request.response_format?.type === 'json_object') {
      bodyParams.response_format = { type: 'json_object' };
    }

    // 工具调用
    if (request.tools?.length) {
      bodyParams.tools = request.tools;
      bodyParams.tool_choice = request.tool_choice || 'auto';
    }

    // logprobs 支持（仅非推理模型）
    if (!isReasoner) {
      if (request.logprobs !== undefined) bodyParams.logprobs = request.logprobs;
      if (request.top_logprobs !== undefined) bodyParams.top_logprobs = request.top_logprobs;
    }

    const fetchConfig = proxyManager.getFetchConfig({
      method: 'POST',
      headers: this.getHeaders(apiKey),
      body: JSON.stringify(bodyParams)
    });

    const response = await fetch(this.getApiEndpoint(), fetchConfig);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json() as any;
    const choice = result.choices?.[0];

    return {
      content: choice?.message?.content || '',
      thinking: choice?.message?.reasoning_content || undefined, // DeepSeek推理模型的思维链内容
      tool_calls: choice?.message?.tool_calls || undefined,
      finish_reason: choice?.finish_reason || undefined,
      usage: result.usage
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, proxyManager.getFetchConfig({
        method: 'HEAD',
        timeout: 5000
      }));
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  private processStreamChunk(
    parsed: any, 
    isReasoner: boolean, 
    accumulatedToolCalls: { [key: number]: any },
    onData: StreamCallback
  ): void {
    if (!parsed.choices?.[0]?.delta) return;

    const delta = parsed.choices[0].delta;

    // 处理常规内容
    if (delta.content) {
      onData(JSON.stringify({ content: delta.content }), 'content_chunk');
    }

    // 处理推理内容
    if (isReasoner && delta.reasoning_content) {
      onData(JSON.stringify({ reasoning_content: delta.reasoning_content }), 'thinking_step');
    }

    // 处理工具调用
    if (delta.tool_calls) {
      this.processToolCallDeltas(delta.tool_calls, accumulatedToolCalls);
    }

    // 处理完成状态
    if (parsed.choices[0].finish_reason) {
      this.handleStreamComplete(accumulatedToolCalls, onData);
    }
  }

  private processToolCallDeltas(toolCallDeltas: any[], accumulatedToolCalls: { [key: number]: any }): void {
    for (const delta of toolCallDeltas) {
      const index = delta.index;
      if (!accumulatedToolCalls[index]) {
        accumulatedToolCalls[index] = { arguments: '' };
      }
      
      if (delta.id) accumulatedToolCalls[index].id = delta.id;
      if (delta.function?.name) accumulatedToolCalls[index].name = delta.function.name;
      if (delta.function?.arguments) accumulatedToolCalls[index].arguments += delta.function.arguments;
    }
  }

  private handleStreamComplete(accumulatedToolCalls: { [key: number]: any }, onData: StreamCallback): void {
    // 发送累积的工具调用
    for (const index in accumulatedToolCalls) {
      const toolCall = accumulatedToolCalls[index];
      if (toolCall.id && toolCall.name && toolCall.arguments) {
        try {
          const parsedArgs = JSON.parse(toolCall.arguments);
          onData(JSON.stringify({ 
            tool_call_id: toolCall.id, 
            tool_name: toolCall.name, 
            tool_arguments: parsedArgs 
          }), 'tool_use_step');
        } catch {
          onData(JSON.stringify({ 
            tool_call_id: toolCall.id, 
            tool_name: toolCall.name, 
            tool_arguments_raw: toolCall.arguments 
          }), 'tool_use_step');
        }
      }
    }

    onData(JSON.stringify({ finish_reason: 'stop' }), 'content_chunk');
  }
} 