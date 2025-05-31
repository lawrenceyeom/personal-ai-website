// utils/llm/providers/gemini/index.ts
// Gemini提供商实现

import axios from 'axios';
import { BaseLLMProvider } from '../../core/base-provider';
import { LLMRequest, LLMResponse, StreamCallback, ModelConfig, LLMProvider } from '../../core/types';
import { proxyManager } from '../../../network/proxy';
import { GEMINI_MODELS } from './models';

export class GeminiProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string) {
    super(LLMProvider.GOOGLE, 'Gemini', apiKey);
  }

  getModels(): Record<string, ModelConfig> {
    return GEMINI_MODELS;
  }

  getDefaultApiKey(): string {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  protected getApiEndpoint(): string {
    return `${this.baseUrl}/models`;
  }

  protected getApiEndpointForModel(modelName: string): string {
    return `${this.baseUrl}/models/${modelName}:generateContent`;
  }

  protected getStreamApiEndpoint(modelName: string): string {
    return `${this.baseUrl}/models/${modelName}:streamGenerateContent?alt=sse`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
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
    cleaned.top_k = this.validateParameter(cleaned.top_k, supports.top_k);
    cleaned.max_tokens = this.validateParameter(cleaned.max_tokens, supports.max_tokens);

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
          return reject(new Error('Gemini API密钥未配置'));
        }

        const modelInfo = this.getModelInfo(request.model);
        const isReasoner = modelInfo?.isReasoner || false;

        // 构建Gemini请求格式
        const contents = this.buildContents(request.messages, request.system);
        const generationConfig = this.buildGenerationConfig(request, isReasoner);

        const bodyParams: any = {
          contents: contents,
          generationConfig: generationConfig
        };

        // 系统指令
        if (request.system && modelInfo?.supports?.system_instructions) {
          bodyParams.systemInstruction = {
            parts: [{ text: request.system }]
          };
        }

        // 工具配置
        if (request.tools?.length && modelInfo?.supports?.tools) {
          bodyParams.tools = this.convertTools(request.tools);
        }

        // 思维推理配置
        if (isReasoner) {
          // 为推理模型启用思考配置
          let thinkingConfig = request.thinking;
          if (!thinkingConfig) {
            // 如果没有设置思考配置，为推理模型设置默认配置
            thinkingConfig = { include_thoughts: true };
          }
          bodyParams.generationConfig.thinkingConfig = this.buildThinkingConfig(thinkingConfig);
        }

        // 安全设置（可选）
        if (request.safety_settings) {
          bodyParams.safetySettings = request.safety_settings;
        }

        this.debugLog('Request', {
          model: request.model,
          contentsCount: contents.length,
          isReasoner,
          hasTools: !!request.tools?.length,
          endpoint: 'streamGenerateContent'
        });

        const modelName = request.model_id || modelInfo?.apiModel || request.model;
        const axiosConfig = proxyManager.getAxiosConfig({
          method: 'POST',
          url: `${this.getStreamApiEndpoint(modelName)}&key=${apiKey}`,
          headers: this.getHeaders(),
          data: bodyParams,
          responseType: 'stream'
        });

        const response = await axios.request(axiosConfig);

        if (response.status !== 200) {
          throw new Error(`Gemini API Error: ${response.status} - ${response.statusText}`);
        }

        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          buffer += text;

          // 处理SSE格式的数据
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一行（可能不完整）

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.substring(6).trim();
              
              // 跳过空数据和[DONE]
              if (!data || data === '[DONE]') {
                continue;
              }
              
              try {
                const parsed = JSON.parse(data);
                this.processStreamChunk(parsed, isReasoner, onData);
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
          onData(JSON.stringify({ finish_reason: 'stop' }), 'done');
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
      throw new Error('Gemini API密钥未配置');
    }

    const modelInfo = this.getModelInfo(request.model);
    const isReasoner = modelInfo?.isReasoner || false;

    // 构建请求体
    const contents = this.buildContents(request.messages, request.system);
    const generationConfig = this.buildGenerationConfig(request, isReasoner);

    const bodyParams: any = {
      contents: contents,
      generationConfig: generationConfig
    };

    // 系统指令
    if (request.system && modelInfo?.supports?.system_instructions) {
      bodyParams.systemInstruction = {
        parts: [{ text: request.system }]
      };
    }

    // 工具配置
    if (request.tools?.length && modelInfo?.supports?.tools) {
      bodyParams.tools = this.convertTools(request.tools);
    }

    // 思维推理配置
    if (isReasoner) {
      // 为推理模型启用思考配置
      let thinkingConfig = request.thinking;
      if (!thinkingConfig) {
        // 如果没有设置思考配置，为推理模型设置默认配置
        thinkingConfig = { include_thoughts: true };
      }
      bodyParams.generationConfig.thinkingConfig = this.buildThinkingConfig(thinkingConfig);
    }

    const modelName = request.model_id || modelInfo?.apiModel || request.model;
    const axiosConfig = proxyManager.getAxiosConfig({
      method: 'POST',
      url: `${this.getApiEndpointForModel(modelName)}?key=${apiKey}`,
      headers: this.getHeaders(),
      data: bodyParams
    });

    const response = await axios.request(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`Gemini API Error: ${response.status} - ${response.data?.error?.message || response.statusText}`);
    }

    const result = response.data;
    const candidate = result.candidates?.[0];
    
    if (!candidate) {
      throw new Error('No valid response from Gemini API');
    }

    // 处理响应内容
    let content = '';
    let thinking = '';
    const toolCalls: any[] = [];

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        if (part.thought) {
          thinking += part.text;
        } else {
          content += part.text;
        }
      } else if (part.functionCall) {
        toolCalls.push({
          id: part.functionCall.name + '_' + Date.now(),
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
    }

    return {
      content: content,
      thinking: thinking || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      finish_reason: candidate.finishReason || undefined,
      usage: result.usageMetadata ? {
        prompt_tokens: result.usageMetadata.promptTokenCount || 0,
        completion_tokens: result.usageMetadata.candidatesTokenCount || 0,
        total_tokens: result.usageMetadata.totalTokenCount || 0,
        reasoning_tokens: result.usageMetadata.thoughtsTokenCount || undefined
      } : undefined
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const apiKey = this.getDefaultApiKey();
      if (!apiKey) return false;

      // 使用简单的模型列表请求来检查连接
      const axiosConfig = proxyManager.getAxiosConfig({
        method: 'GET',
        url: `${this.baseUrl}/models?key=${apiKey}`,
        headers: this.getHeaders(),
        timeout: 5000
      });

      const response = await axios.request(axiosConfig);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 构建Gemini内容格式
   */
  private buildContents(messages: any[], systemInstruction?: string): any[] {
    const contents: any[] = [];

    for (const message of messages) {
      // 跳过系统消息，因为Gemini用systemInstruction处理
      if (message.role === 'system') {
        continue;
      }

      // 跳过空消息
      if (!message.content && !message.tool_call_id) {
        continue;
      }

      const content: any = {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: []
      };

      // 处理消息内容
      if (typeof message.content === 'string') {
        if (message.content.trim()) {
          content.parts.push({ text: message.content });
        }
      } else if (Array.isArray(message.content)) {
        // 多模态内容处理
        for (const part of message.content) {
          if (part.type === 'text' && part.text && part.text.trim()) {
            content.parts.push({ text: part.text });
          } else if (part.type === 'image_url') {
            try {
              // 处理图像内容
              content.parts.push(this.processImageContent(part.image_url));
            } catch (error) {
              this.debugLog('Image Error', `Failed to process image: ${error.message}`);
              // 继续处理其他内容，不因图像错误而失败
            }
          } else if (part.fileData) {
            // 处理Gemini文件数据格式 - 使用正确的API格式
            try {
              content.parts.push({
                file_data: {
                  mime_type: part.fileData.mimeType,
                  file_uri: part.fileData.fileUri
                }
              });
              this.debugLog('File Data', `Added file: ${part.fileData.fileUri}`);
            } catch (error) {
              this.debugLog('File Error', `Failed to process file: ${error.message}`);
            }
          } else if (part.file_data) {
            // 处理已经是正确格式的文件数据
            try {
              content.parts.push({
                file_data: {
                  mime_type: part.file_data.mime_type || part.file_data.mimeType,
                  file_uri: part.file_data.file_uri || part.file_data.fileUri
                }
              });
              this.debugLog('File Data', `Added file: ${part.file_data.file_uri || part.file_data.fileUri}`);
            } catch (error) {
              this.debugLog('File Error', `Failed to process file: ${error.message}`);
            }
          }
        }
      } else if (message.content && typeof message.content === 'object') {
        // 处理对象类型的内容
        if (message.content.text) {
          content.parts.push({ text: message.content.text });
        }
      }

      // 处理工具调用响应
      if (message.tool_call_id && message.role === 'tool') {
        try {
          const response = typeof message.content === 'string' 
            ? JSON.parse(message.content) 
            : message.content;
          content.parts.push({
            functionResponse: {
              name: message.name || 'function',
              response: response
            }
          });
        } catch (error) {
          this.debugLog('Tool Response Error', `Failed to parse tool response: ${error.message}`);
        }
      }

      // 只添加有内容的消息
      if (content.parts.length > 0) {
        contents.push(content);
      }
    }

    // 确保至少有一条用户消息
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }]
      });
    }

    // 调试日志：显示最终构建的contents
    this.debugLog('Built Contents', `Total contents: ${contents.length}`);
    contents.forEach((content, index) => {
      const fileRefs = content.parts?.filter((part: any) => part.file_data) || [];
      if (fileRefs.length > 0) {
        this.debugLog('Content Debug', `Content ${index} contains ${fileRefs.length} file(s): ${JSON.stringify(fileRefs)}`);
      }
    });

    return contents;
  }

  /**
   * 构建生成配置
   */
  private buildGenerationConfig(request: LLMRequest, isReasoner: boolean): any {
    const config: any = {};

    if (request.temperature !== undefined) config.temperature = request.temperature;
    if (request.top_p !== undefined) config.topP = request.top_p;
    if (request.top_k !== undefined) config.topK = request.top_k;
    if (request.max_tokens !== undefined) config.maxOutputTokens = request.max_tokens;

    if (request.stop_sequences?.length) {
      config.stopSequences = request.stop_sequences;
    }

    if (request.response_format?.type === 'json_object') {
      config.responseMimeType = 'application/json';
    }

    return config;
  }

  /**
   * 构建思维推理配置
   */
  private buildThinkingConfig(thinking: any): any {
    const config: any = {};

    // 为推理模型默认启用思考展示
    if (thinking === true || thinking === undefined) {
      config.includeThoughts = true;
    } else if (typeof thinking === 'object') {
      if (thinking.include_thoughts !== undefined) {
        config.includeThoughts = thinking.include_thoughts;
      } else {
        // 默认启用思考展示
        config.includeThoughts = true;
      }

      if (thinking.budget_tokens !== undefined) {
        config.thinkingBudget = thinking.budget_tokens;
      }
    }

    return config;
  }

  /**
   * 转换工具格式为Gemini格式
   */
  private convertTools(tools: any[]): any[] {
    const geminiTools = [];

    for (const tool of tools) {
      if (tool.type === 'function') {
        // 函数工具
        if (!geminiTools.find(t => t.functionDeclarations)) {
          geminiTools.push({ functionDeclarations: [] });
        }
        const functionsIndex = geminiTools.findIndex(t => t.functionDeclarations);
        
        geminiTools[functionsIndex].functionDeclarations.push({
          name: tool.name || tool.function?.name,
          description: tool.description || tool.function?.description,
          parameters: tool.parameters || tool.function?.parameters
        });
      } else if (tool.google_search || tool.googleSearch) {
        // Google Search工具 - 使用Gemini 2.0的新格式
        geminiTools.push({
          google_search: {}  // Gemini 2.0的新格式，不再使用googleSearchRetrieval
        });
        this.debugLog('Google Search Tool', 'Added Google Search tool (Gemini 2.0 format)');
      } else if (tool.code_execution || tool.codeExecution) {
        // 代码执行工具
        geminiTools.push({
          codeExecution: {}
        });
        this.debugLog('Code Execution Tool', 'Added code execution tool');
      } else {
        // 其他工具格式，直接添加
        geminiTools.push(tool);
      }
    }

    this.debugLog('Converted Tools', `Tools converted: ${geminiTools.length} tools`);
    return geminiTools;
  }

  /**
   * 处理图像内容
   */
  private processImageContent(imageUrl: any): any {
    if (imageUrl.url && imageUrl.url.startsWith('data:')) {
      // 处理base64图像
      const [mimeType, base64Data] = imageUrl.url.replace('data:', '').split(';base64,');
      return {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      };
    }
    
    // 处理URL图像（需要先下载）
    throw new Error('Direct image URLs not supported, please convert to base64');
  }

  /**
   * 处理流式数据块
   */
  private processStreamChunk(parsed: any, isReasoner: boolean, onData: StreamCallback): void {
    // 检查是否有候选响应
    if (!parsed.candidates || !Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
      // 如果没有候选响应但有错误，处理错误
      if (parsed.error) {
        onData(JSON.stringify({ 
          error: parsed.error.message || 'Gemini API Error',
          details: parsed.error 
        }), 'error');
      }
      return;
    }

    const candidate = parsed.candidates[0];
    
    // 调试信息：打印接收到的数据结构
    if (isReasoner) {
      this.debugLog('Stream Chunk', `Received candidate: ${JSON.stringify({
        hasContent: !!candidate.content,
        hasParts: !!candidate.content?.parts,
        partsCount: candidate.content?.parts?.length || 0,
        finishReason: candidate.finishReason
      })}`);
    }
    
    // 检查内容部分
    if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
      for (const part of candidate.content.parts) {
        // 调试信息：打印每个part的内容
        if (isReasoner) {
          this.debugLog('Processing Part', {
            hasText: !!part.text,
            isThought: !!part.thought,
            hasFunctionCall: !!part.functionCall,
            textLength: part.text?.length || 0
          });
        }

        if (part.text) {
          if (part.thought) {
            // 思维内容（推理模型）- Gemini格式
            this.debugLog('Thinking Content', `Sending thinking: ${part.text.substring(0, 100)}...`);
            onData(JSON.stringify({ thinking: part.text }), 'thinking_step');
          } else {
            // 常规内容
            this.debugLog('Regular Content', `Sending content: ${part.text.substring(0, 100)}...`);
            onData(JSON.stringify({ content: part.text }), 'content_chunk');
          }
        } else if (part.functionCall) {
          // 工具调用
          onData(JSON.stringify({
            tool_call_id: part.functionCall.name + '_' + Date.now(),
            tool_name: part.functionCall.name,
            tool_arguments: part.functionCall.args || {}
          }), 'tool_use_step');
        }
      }
    }

    // 检查完成原因
    if (candidate.finishReason) {
      this.debugLog('Finish Reason', candidate.finishReason);
      onData(JSON.stringify({ finish_reason: candidate.finishReason }), 'done');
    }

    // 检查阻塞原因（安全过滤等）
    if (candidate.safetyRatings) {
      for (const rating of candidate.safetyRatings) {
        if (rating.blocked) {
          onData(JSON.stringify({
            error: 'Content blocked by safety filters',
            details: { category: rating.category, reason: rating.reason }
          }), 'error');
          return;
        }
      }
    }
  }
} 