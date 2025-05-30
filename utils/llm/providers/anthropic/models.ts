// utils/llm/providers/anthropic/models.ts
// Anthropic Claude模型配置

import { ModelConfig, LLMProvider } from '../../core/types';

export const ANTHROPIC_MODELS: Record<string, ModelConfig> = {
  // Claude 4 系列 - 最新旗舰模型
  'claude-opus-4': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-opus-4-20250514',
    knowledgeCutoff: '2024-12', // 基于Claude 4发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 32000, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 100000, default: 25000 },
        include_thoughts: true
      },
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },
  'claude-sonnet-4': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-sonnet-4-20250514',
    knowledgeCutoff: '2024-12', // 基于Claude 4发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 64000, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 100000, default: 25000 },
        include_thoughts: true
      },
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },

  // Claude 3.5 系列 - 成熟稳定模型
  'claude-3.5-sonnet': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-3-5-sonnet-20241022',
    knowledgeCutoff: '2024-04', // 基于Claude 3.5发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 8192, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 100000, default: 25000 },
        include_thoughts: true
      },
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },
  'claude-3.5-haiku': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-3-5-haiku-20241022',
    knowledgeCutoff: '2024-04', // 基于Claude 3.5发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 8192, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 100000, default: 25000 },
        include_thoughts: true
      },
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },

  // Claude 3 系列 - 经典模型
  'claude-3-opus': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-3-opus-20240229',
    knowledgeCutoff: '2023-04', // 基于Claude 3发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 4096, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },
  'claude-3-sonnet': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-3-sonnet-20240229',
    knowledgeCutoff: '2023-04', // 基于Claude 3发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 4096, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  },
  'claude-3-haiku': {
    provider: LLMProvider.ANTHROPIC,
    apiModel: 'claude-3-haiku-20240307',
    knowledgeCutoff: '2023-04', // 基于Claude 3发布时间推断
    supports: {
      temperature: { min: 0, max: 1, default: 1 },
      top_p: { min: 0.95, max: 1, default: 0.99 },
      top_k: { min: 0, max: 200, default: 40 },
      max_tokens: { min: 1, max: 4096, default: 4096 },
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true,
      system_instructions: true,
      documents: false
    }
  }
}; 