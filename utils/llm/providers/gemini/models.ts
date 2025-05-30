// utils/llm/providers/gemini/models.ts
// Google Gemini模型配置 - 基于官方文档 v2025

import { ModelConfig, LLMProvider } from '../../core/types';

export const GEMINI_MODELS: Record<string, ModelConfig> = {
  // Gemini 2.5 Pro Preview - 最先进的思维推理模型
  'gemini-2.5-pro-preview': {
    provider: LLMProvider.GOOGLE,
    apiModel: 'gemini-2.5-pro-preview-05-06',
    isReasoner: true,
    knowledgeCutoff: '知识截断2025-01',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 100, default: 40 },
      max_tokens: { min: 1, max: 65536, default: 8192 }, // 官方文档：最大65K
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 65536, default: 32768 },
        include_thoughts: true
      },
      tools: true,
      vision: true, // 支持音频、图像、视频、文本
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多1000页
      structured_output: true,
      reasoning: true
    }
  },

  // Gemini 2.5 Flash Preview - 性价比最佳的混合推理模型
  'gemini-2.5-flash-preview': {
    provider: LLMProvider.GOOGLE,
    apiModel: 'gemini-2.5-flash-preview-05-20',
    isReasoner: true,
    knowledgeCutoff: '知识截断2025-01',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 100, default: 40 },
      max_tokens: { min: 1, max: 65536, default: 8192 }, // 官方文档：最大65K
      stop_sequences: { max_count: 5 },
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 65536, default: 32768 },
        include_thoughts: true
      },
      tools: true,
      vision: true, // 支持文本、图像、视频、音频
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多1000页
      structured_output: true,
      reasoning: true
    }
  },

  // Gemini 2.0 Flash - 平衡的多模态模型
  'gemini-2.0-flash': {
    provider: LLMProvider.GOOGLE,
    apiModel: 'gemini-2.0-flash',
    knowledgeCutoff: '知识截断2024-08',
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 0.95 },
      top_k: { min: 1, max: 100, default: 40 },
      max_tokens: { min: 1, max: 8192, default: 4096 }, // 官方文档：最大8K
      stop_sequences: { max_count: 5 },
      thinking: false,
      tools: true,
      vision: true, // 支持音频、图像、视频、文本
      system_instructions: true,
      documents: true, // ✅ 支持PDF文档，最多1000页
      structured_output: true
    }
  }
}; 