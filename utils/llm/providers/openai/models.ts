// utils/llm/providers/openai/models.ts
// OpenAI模型配置 - 基于官方文档 v2025

import { ModelConfig, LLMProvider } from '../../core/types';

export const OPENAI_MODELS: Record<string, ModelConfig> = {
  // GPT-4.1 系列 - 旗舰模型 (默认首选)
  'gpt-4.1': {
    provider: LLMProvider.OPENAI,
    apiModel: 'gpt-4.1',
    knowledgeCutoff: '知识截断2024-06',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 32768, default: 4096 }, // 官方文档：最大32K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true, // 支持视觉
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多100页，32MB
      structured_output: true
    }
  },

  // o3-mini 推理模型
  'o3-mini': {
    provider: LLMProvider.OPENAI,
    apiModel: 'o3-mini',
    isReasoner: true,
    knowledgeCutoff: '知识截断2023-10',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 100000, default: 32768 }, // 官方文档：最大100K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 100000, default: 32768 },
        include_thoughts: true
      },
      stop_sequences: { max_count: 4 },
      tools: true,
      vision: false, // 仅文本
      system_instructions: true,
      documents: false, // ❌ o3-mini不支持多模态，不支持文档
      structured_output: true,
      reasoning: true
    }
  },

  // GPT-4o 系列 - 多模态旗舰模型
  'gpt-4o': {
    provider: LLMProvider.OPENAI,
    apiModel: 'gpt-4o',
    knowledgeCutoff: '知识截断2023-10',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 16384, default: 4096 }, // 官方文档：最大16K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true, // 支持视觉
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多100页，32MB
      structured_output: true
    }
  },

  // GPT-4o Mini - 经济型模型
  'gpt-4o-mini': {
    provider: LLMProvider.OPENAI,
    apiModel: 'gpt-4o-mini',
    knowledgeCutoff: '知识截断2023-10',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 16384, default: 4096 }, // 官方文档：最大16K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true,
      vision: true, // 支持视觉
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多100页，32MB
      structured_output: true
    }
  }
}; 