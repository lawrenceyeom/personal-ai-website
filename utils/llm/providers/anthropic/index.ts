// utils/llm/providers/anthropic/index.ts
// Anthropic提供商实现

import axios from 'axios';
import { BaseLLMProvider } from '../../core/base-provider';
import { LLMRequest, LLMResponse, StreamCallback, ModelConfig, LLMProvider } from '../../core/types';
import { proxyManager } from '../../../network/proxy';
import { ANTHROPIC_MODELS } from './models';

export class AnthropicProvider extends BaseLLMProvider {
  private readonly baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey?: string) {
    super(LLMProvider.ANTHROPIC, 'Anthropic', apiKey);
  }

  getModels(): Record<string, ModelConfig> {
    return ANTHROPIC_MODELS;
  }

  getDefaultApiKey(): string {
    return process.env.ANTHROPIC_API_KEY || '';
  }

  protected getApiEndpoint(): string {
    return `${this.baseUrl}/messages`;
  }

  protected getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
  }

  validateAndCleanRequest(request: LLMRequest): LLMRequest {
    const modelInfo = this.getModelInfo(request.model);
    if (!modelInfo?.supports) {
      return request;
    }

    const cleaned: LLMRequest = { ...request };
    const supports = modelInfo.supports;

    // 验证和清理参数
    if (cleaned.temperature !== undefined && supports.temperature) {
      cleaned.temperature = Math.max(supports.temperature.min, 
        Math.min(supports.temperature.max, cleaned.temperature));
    } else if (!supports.temperature) {
      delete cleaned.temperature;
    }

    if (cleaned.top_p !== undefined && supports.top_p) {
      cleaned.top_p = Math.max(supports.top_p.min, 
        Math.min(supports.top_p.max, cleaned.top_p));
    } else if (!supports.top_p) {
      delete cleaned.top_p;
    }

    if (cleaned.top_k !== undefined && supports.top_k) {
      cleaned.top_k = Math.max(supports.top_k.min, 
        Math.min(supports.top_k.max, cleaned.top_k));
    } else if (!supports.top_k) {
      delete cleaned.top_k;
    }

    if (cleaned.max_tokens !== undefined && supports.max_tokens) {
      cleaned.max_tokens = Math.max(supports.max_tokens.min, 
        Math.min(supports.max_tokens.max, cleaned.max_tokens));
    }

    if (cleaned.stop_sequences && supports.stop_sequences) {
      cleaned.stop_sequences = cleaned.stop_sequences.slice(0, supports.stop_sequences.max_count);
    } else if (!supports.stop_sequences) {
      delete cleaned.stop_sequences;
    }

    // 处理thinking参数
    if (cleaned.thinking && !supports.thinking) {
      delete cleaned.thinking;
    }

    // 处理工具参数
    if (cleaned.tools && !supports.tools) {
      delete cleaned.tools;
      delete cleaned.tool_choice;
    }

    return cleaned;
  }

  async callStream(request: LLMRequest, onData: StreamCallback): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const apiKey = this.apiKey || this.getDefaultApiKey();
        if (!apiKey) {
          throw new Error('Anthropic API key not found');
        }

        const modelInfo = this.getModelInfo(request.model);
        if (!modelInfo) {
          throw new Error(`Model ${request.model} not found`);
        }

        const supportsThinking = modelInfo.supports?.thinking || false;
        
        // 处理消息格式
        const systemPrompt = request.messages.find(m => m.role === 'system')?.content as string | undefined;
        const userAssistantMessages = request.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => {
            // 处理多模态内容
            if (Array.isArray(m.content)) {
              const contentParts: any[] = [];
              for (const part of m.content) {
                if (part.type === 'text') {
                  contentParts.push({ type: 'text', text: part.text });
                } else if (part.type === 'image_url' && part.image_url?.url) {
                  // 提取base64数据
                  const base64Match = part.image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
                  if (base64Match) {
                    contentParts.push({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: `image/${base64Match[1]}`,
                        data: base64Match[2]
                      }
                    });
                  }
                }
              }
              return { role: m.role, content: contentParts };
            }
            return { role: m.role, content: m.content };
          });

        const headers = this.getHeaders(apiKey);
        
        // Claude 4模型需要特殊的beta头
        const isClande4 = modelInfo.apiModel.includes('claude-opus-4') || modelInfo.apiModel.includes('claude-sonnet-4');
        
        if (isClande4) {
          if (supportsThinking) {
            headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
          } else {
            headers['anthropic-beta'] = 'tools-2024-05-16';
          }
        } else {
          // Claude 3.x 标准处理
          if (supportsThinking) {
            headers['anthropic-beta'] = 'thinking-2024-12-19,tools-2024-05-16';
          } else {
            headers['anthropic-beta'] = 'tools-2024-05-16';
          }
        }

        const bodyParams: any = {
          model: modelInfo.apiModel,
          messages: userAssistantMessages,
          stream: true,
          max_tokens: request.max_tokens || 8192,
        };

        // 系统提示词设置
        let finalSystemPrompt = systemPrompt;
        if (request.system && request.system.trim()) {
          finalSystemPrompt = request.system;
        }
        if (finalSystemPrompt) {
          bodyParams.system = finalSystemPrompt;
        }

        // 参数设置
        if (request.temperature !== undefined) bodyParams.temperature = request.temperature;
        if (request.top_p !== undefined) bodyParams.top_p = request.top_p;
        if (request.top_k !== undefined) bodyParams.top_k = request.top_k;
        
        if (request.stop_sequences && request.stop_sequences.length > 0) {
          bodyParams.stop_sequences = request.stop_sequences.slice(0, 5);
        }

        // Thinking设置
        if (supportsThinking) {
          if (request.thinking?.budget_tokens) {
            bodyParams.thinking = { budget_tokens: request.thinking.budget_tokens };
          } else {
            bodyParams.thinking = {};
          }
        }

        // 工具调用支持
        if (request.tools && request.tools.length > 0) {
          bodyParams.tools = request.tools;
          if (request.tool_choice) {
            bodyParams.tool_choice = request.tool_choice;
          }
        }

        this.debugLog('Request', {
          model: request.model,
          messagesCount: userAssistantMessages.length,
          hasSystem: !!finalSystemPrompt,
          hasThinking: supportsThinking,
          hasTools: !!request.tools?.length
        });

        const axiosConfig = proxyManager.getAxiosConfig({
          method: 'POST',
          url: this.getApiEndpoint(),
          headers,
          data: bodyParams,
          responseType: 'stream'
        });

        const response = await axios.request(axiosConfig);

        if (response.status !== 200) {
          throw new Error(`Anthropic API Error: ${response.status} - ${response.statusText}`);
        }

        const stream = response.data;
        const decoder = new TextDecoder('utf-8');
        let accumulatedBuffer = '';
        let inThinkingTag = false;
        let currentToolCallInfo: { id: string, name: string, input: string } | null = null;

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
                  this.processStreamEvent(eventType, parsed, inThinkingTag, currentToolCallInfo, onData);
                } catch (e) {
                  this.debugLog('Parse Error', `Failed to parse: ${jsonData}`);
                  onData(JSON.stringify({ 
                    error: 'Error parsing Claude stream data', 
                    details: jsonData 
                  }), 'error');
                }
              }
            }
          }
        });

        stream.on('end', () => {
          this.debugLog('Stream', 'Ended');
          if (inThinkingTag) inThinkingTag = false;
          onData(JSON.stringify({ finish_reason: 'stop' }), 'done');
          resolve();
        });

        stream.on('error', (err: any) => {
          this.debugLog('Stream Error', err.message);
          if (inThinkingTag) inThinkingTag = false;
          reject(this.handleError(err, 'stream'));
        });

      } catch (error) {
        reject(this.handleError(error, 'callStream'));
      }
    });
  }

  async callNonStream(request: LLMRequest): Promise<LLMResponse> {
    // 实现非流式调用
    throw new Error('Non-stream calls not implemented for Anthropic provider yet');
  }

  async checkConnection(): Promise<boolean> {
    try {
      const apiKey = this.apiKey || this.getDefaultApiKey();
      if (!apiKey) return false;

      // 简单的连接测试
      const axiosConfig = proxyManager.getAxiosConfig({
        method: 'GET',
        url: `${this.baseUrl}/messages`,
        headers: this.getHeaders(apiKey),
        timeout: 5000
      });

      const response = await axios.request(axiosConfig);
      return response.status < 500;
    } catch (error: any) {
      // 401/403表示密钥问题但连接正常，400表示请求格式问题但连接正常
      return error.response?.status < 500;
    }
  }

  private processStreamEvent(
    eventType: string, 
    parsed: any, 
    inThinkingTag: boolean, 
    currentToolCallInfo: any, 
    onData: StreamCallback
  ): void {
    if (eventType === 'content_block_start') {
      if (parsed.content_block?.type === 'tool_use') {
        currentToolCallInfo = { 
          id: parsed.content_block.id, 
          name: parsed.content_block.name, 
          input: '' 
        };
      }
    } else if (eventType === 'thinking_delta') {
      if (parsed.delta?.text) {
        onData(JSON.stringify({ content: parsed.delta.text }), 'thinking_step');
      }
    } else if (eventType === 'content_block_delta') {
      if (parsed.delta?.type === 'text_delta') {
        let text = parsed.delta.text;
        
        // 处理<thinking>...</thinking>标签
        let thinkingContent = '';
        let regularContent = '';

        while(text && text.length > 0) {
          if (inThinkingTag) {
            const endTagIndex = text.indexOf('</thinking>');
            if (endTagIndex !== -1) {
              thinkingContent = text.substring(0, endTagIndex);
              if (thinkingContent) {
                onData(JSON.stringify({ content: thinkingContent }), 'thinking_step');
              }
              text = text.substring(endTagIndex + '</thinking>'.length);
              inThinkingTag = false;
            } else {
              if (text) {
                onData(JSON.stringify({ content: text }), 'thinking_step');
              }
              text = '';
            }
          } else {
            const startTagIndex = text.indexOf('<thinking>');
            if (startTagIndex !== -1) {
              regularContent = text.substring(0, startTagIndex);
              if (regularContent) {
                onData(JSON.stringify({ content: regularContent }), 'content_chunk');
              }
              text = text.substring(startTagIndex + '<thinking>'.length);
              inThinkingTag = true;
            } else {
              if (text) {
                onData(JSON.stringify({ content: text }), 'content_chunk');
              }
              text = '';
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
          onData(JSON.stringify({ 
            tool_id: currentToolCallInfo.id, 
            tool_name: currentToolCallInfo.name, 
            tool_input: parsedInput 
          }), 'tool_use_step');
        } catch (e) {
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
        onData(JSON.stringify({ 
          finish_reason: parsed.delta.stop_reason, 
          usage: parsed.usage 
        }), 'done');
      }
    }
  }

  /**
   * 调试日志输出
   */
  protected debugLog(type: string, message: any): void {
    console.log(`[${this.name.toUpperCase()}-DEBUG] ${type}: ${typeof message === 'object' ? JSON.stringify(message) : message}`);
  }
} 