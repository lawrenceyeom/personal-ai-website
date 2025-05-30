// utils/llm/providers/xai/models.ts
// xAI Grok模型配置 - 基于官方文档 v2025

import { ModelConfig, LLMProvider } from '../../core/types';

export const XAI_MODELS: Record<string, ModelConfig> = {
  // Grok 3 Latest - 企业级旗舰模型 (默认首选)
  'grok-3-latest': {
    provider: LLMProvider.XAI,
    apiModel: 'grok-3-latest',
    knowledgeCutoff: '知识截断2024-10', // 基于最新Grok 3模型推断
    supports: {
      temperature: { min: 0, max: 2, default: 0.7 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 131072, default: 4096 }, // 官方文档：上下文窗口131K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true, // 支持函数调用
      vision: false, // 文本输入→文本输出
      system_instructions: true,
      documents: false,
      structured_output: true // 支持结构化输出
    }
  },

  // Grok 3 Mini Fast - 轻量级推理模型快速版
  'grok-3-mini-fast': {
    provider: LLMProvider.XAI,
    apiModel: 'grok-3-mini-fast',
    isReasoner: true,
    knowledgeCutoff: '知识截断2024-10', // 基于Grok 3系列推断
    supports: {
      temperature: { min: 0, max: 2, default: 0.7 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 131072, default: 4096 }, // 官方文档：上下文窗口131K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      reasoning_effort: { 
        enabled: true,
        options: ['low', 'high'], 
        default: 'low' 
      }, // 快速版本使用低推理努力
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 50000, default: 25000 },
        include_thoughts: true
      },
      stop_sequences: { max_count: 4 },
      tools: true, // 支持函数调用
      vision: false, // 文本输入→文本输出
      system_instructions: true,
      documents: false,
      structured_output: true, // 支持结构化输出
      reasoning: true
    }
  },

  // Grok 2 Image - 图像生成模型
  'grok-2-image': {
    provider: LLMProvider.XAI,
    apiModel: 'grok-2-image-1212',
    knowledgeCutoff: '知识截断2024-08', // 基于Grok 2系列推断
    supports: {
      temperature: { min: 0, max: 1, default: 0.7 },
      max_tokens: { min: 1, max: 1000, default: 500 }, // 图像生成提示长度
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: false,
      vision: false,
      system_instructions: true,
      documents: false,
      structured_output: false,
      image_generation: {
        enabled: true,
        max_images: 10,
        response_formats: ['url', 'b64_json'],
        prompt_revision: true
      }
    }
  }
}; 