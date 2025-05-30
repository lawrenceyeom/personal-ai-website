// utils/llm/providers/openai/index.ts
// OpenAI提供商实现

import axios from 'axios';
import { BaseLLMProvider } from '../../core/base-provider';
import { LLMRequest, LLMResponse, StreamCallback, ModelConfig, LLMProvider } from '../../core/types';
import { proxyManager } from '../../../network/proxy';
import { OPENAI_MODELS } from './models';

export class OpenAIProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey?: string) {
    super(LLMProvider.OPENAI, 'OpenAI', apiKey);
  }

  getModels(): Record<string, ModelConfig> {
    return OPENAI_MODELS;
  }

  getDefaultApiKey(): string {
    return process.env.OPENAI_API_KEY || '';
  }

  protected getApiEndpoint(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected getResponsesApiEndpoint(): string {
    return `${this.baseUrl}/responses`;
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
    cleaned.presence_penalty = this.validateParameter(cleaned.presence_penalty, supports.presence_penalty);
    cleaned.frequency_penalty = this.validateParameter(cleaned.frequency_penalty, supports.frequency_penalty);

    // 清理不支持的参数
    if (!supports.tools) {
      delete cleaned.tools;
      delete cleaned.tool_choice;
    }

    if (!supports.thinking) {
      delete cleaned.thinking;
    }

    if (!supports.system_instructions) {
      delete cleaned.system;
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
          return reject(new Error('OpenAI API密钥未配置'));
        }

        const modelInfo = this.getModelInfo(request.model);
        const isReasoner = modelInfo?.isReasoner || false;

        // 构建消息，处理OpenAI的消息格式
        const messages = this.buildMessages(request.messages, request.system);

        const bodyParams: any = {
          model: request.model_id || request.model,
          messages: messages,
          stream: true
        };

        // 为推理模型使用不同的参数配置
        if (isReasoner) {
          // o3 mini等推理模型使用max_completion_tokens而不是max_tokens
          // 并且需要为推理预留足够空间
          bodyParams.max_completion_tokens = request.max_tokens || 32768;
          
          // 推理模型必需的reasoning_effort参数
          let effort = 'medium'; // 默认值
          if (request.thinking?.type) {
            effort = request.thinking.type; // 使用用户指定的值
          }
          bodyParams.reasoning_effort = effort;
          
          this.debugLog('Reasoning Config', `Set reasoning_effort: ${effort}, max_completion_tokens: ${bodyParams.max_completion_tokens}`);
          
          // 推理模型不支持这些采样参数
          // 不添加temperature, top_p, presence_penalty, frequency_penalty等
        } else {
          // 非推理模型使用传统参数
          bodyParams.max_tokens = request.max_tokens || 4096;
          
          // 添加支持的采样参数
          if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
          if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
          if (request.presence_penalty !== undefined) bodyParams.presence_penalty = request.presence_penalty;
          if (request.frequency_penalty !== undefined) bodyParams.frequency_penalty = request.frequency_penalty;
        }

        // 通用参数（所有模型都支持）
        if (request.seed !== undefined) bodyParams.seed = request.seed;

        // stop序列（非推理模型支持）
        if (!isReasoner && request.stop_sequences?.length) {
          bodyParams.stop = request.stop_sequences.slice(0, 4);
        }

        // 工具调用
        if (request.tools?.length) {
          bodyParams.tools = this.convertTools(request.tools);
          bodyParams.tool_choice = request.tool_choice || 'auto';
        }

        // 响应格式
        if (request.response_format) {
          bodyParams.response_format = request.response_format;
        }

        this.debugLog('Request', {
          model: request.model,
          messagesCount: messages.length,
          isReasoner,
          hasTools: !!request.tools?.length,
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
          throw new Error(`OpenAI API Error: ${response.status} - ${response.statusText}`);
        }

        let buffer = '';
        let accumulatedToolCalls: { [key: number]: any } = {};

        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
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

        response.data.on('error', (error: any) => {
          reject(this.handleError(error, 'stream'));
        });

        response.data.on('end', () => {
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
      throw new Error('OpenAI API密钥未配置');
    }

    const modelInfo = this.getModelInfo(request.model);
    const isReasoner = modelInfo?.isReasoner || false;

    // 构建消息
    const messages = this.buildMessages(request.messages, request.system);

    const bodyParams: any = {
      model: request.model_id || request.model,
      messages: messages,
      stream: false
    };

    // 为推理模型使用不同的参数配置
    if (isReasoner) {
      // o3 mini等推理模型使用max_completion_tokens而不是max_tokens
      bodyParams.max_completion_tokens = request.max_tokens || 32768;
      
      // 推理模型必需的reasoning_effort参数
      let effort = 'medium'; // 默认值
      if (request.thinking?.type) {
        effort = request.thinking.type; // 使用用户指定的值
      }
      bodyParams.reasoning_effort = effort;
      
      // 推理模型不支持采样参数
    } else {
      // 非推理模型使用传统参数
      bodyParams.max_tokens = request.max_tokens || 4096;
      
      // 添加其他参数
      if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
      if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
      if (request.presence_penalty !== undefined) bodyParams.presence_penalty = request.presence_penalty;
      if (request.frequency_penalty !== undefined) bodyParams.frequency_penalty = request.frequency_penalty;
    }

    // 工具调用
    if (request.tools?.length) {
      bodyParams.tools = this.convertTools(request.tools);
      bodyParams.tool_choice = request.tool_choice || 'auto';
    }

    const axiosConfig = proxyManager.getAxiosConfig({
      method: 'POST',
      url: this.getApiEndpoint(),
      headers: this.getHeaders(apiKey),
      data: bodyParams
    });

    const response = await axios.request(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`OpenAI API Error: ${response.status} - ${response.data}`);
    }

    const result = response.data;
    const choice = result.choices?.[0];

    return {
      content: choice?.message?.content || '',
      thinking: choice?.message?.reasoning_content || undefined,
      tool_calls: choice?.message?.tool_calls || undefined,
      finish_reason: choice?.finish_reason || undefined,
      usage: result.usage
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const apiKey = this.getDefaultApiKey();
      if (!apiKey) return false;

      const axiosConfig = proxyManager.getAxiosConfig({
        method: 'GET',
        url: `${this.baseUrl}/models`,
        headers: this.getHeaders(apiKey),
        timeout: 5000
      });

      const response = await axios.request(axiosConfig);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 构建OpenAI消息格式
   */
  private buildMessages(messages: any[], systemInstruction?: string): any[] {
    const result: any[] = [];

    // 添加系统指令
    if (systemInstruction) {
      result.push({
        role: 'system',
        content: systemInstruction
      });
    }

    // 处理消息
    for (const message of messages) {
      const openaiMessage: any = {
        role: message.role === 'tool' ? 'tool' : message.role,
        content: this.processMultimodalContent(message.content)
      };

      // 处理工具调用相关字段
      if (message.tool_call_id) {
        openaiMessage.tool_call_id = message.tool_call_id;
      }
      if (message.name) {
        openaiMessage.name = message.name;
      }

      result.push(openaiMessage);
    }

    return result;
  }

  /**
   * 转换工具格式
   */
  private convertTools(tools: any[]): any[] {
    return tools.map(tool => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.name || tool.function?.name,
            description: tool.description || tool.function?.description,
            parameters: tool.parameters || tool.function?.parameters
          }
        };
      }
      return tool;
    });
  }

  /**
   * 处理流式数据块
   * 
   * 注意：o3 mini等推理模型在API中不支持实时思考过程的流式输出
   * 它们会在内部完成推理后直接返回最终答案，不会发送reasoning_content
   */
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

    // 处理推理内容（仅o1等早期推理模型支持）
    // o3 mini等新推理模型不会在流式API中发送reasoning_content
    if (isReasoner && delta.reasoning_content) {
      this.debugLog('Reasoning Content', `Received reasoning from legacy model: ${delta.reasoning_content.substring(0, 100)}...`);
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

  /**
   * 处理工具调用增量
   */
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

  /**
   * 处理流式完成
   */
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

  /**
   * 处理多模态内容，包括文本、图像和文件
   */
  private processMultimodalContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const processed: any[] = [];
      
      for (const part of content) {
        if (part.type === 'text') {
          processed.push({ type: 'text', text: part.text });
        } else if (part.type === 'image_url') {
          processed.push({
            type: 'image_url',
            image_url: {
              url: part.image_url.url,
              detail: part.image_url.detail || 'auto'
            }
          });
        } else if (part.fileData && part.fileData.fileUri) {
          // Gemini格式的文件数据，不应该出现在OpenAI请求中
          this.debugLog('File Warning', `Gemini fileData found in OpenAI request, skipping: ${part.fileData.fileUri}`);
          console.warn('Gemini fileData found in OpenAI request, skipping:', part.fileData);
        } else if (part.file_id) {
          // OpenAI格式的文件引用
          processed.push({
            type: 'input_file',
            file_id: part.file_id
          });
          this.debugLog('File Reference', `Added OpenAI file reference: ${part.file_id}`);
        }
      }
      
      return processed;
    }

    return content;
  }
} 