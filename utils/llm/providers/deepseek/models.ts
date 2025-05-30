// utils/llm/providers/deepseek/models.ts
// DeepSeek模型配置 - 基于官方文档 v2025

import { ModelConfig, LLMProvider } from '../../core/types';

export const DEEPSEEK_MODELS: Record<string, ModelConfig> = {
  // DeepSeek Chat - 基础对话模型
  'deepseek-chat': {
    provider: LLMProvider.DEEPSEEK,
    apiModel: 'deepseek-chat',
    knowledgeCutoff: '知识截断2024-7', // 基于最新DeepSeek模型推断
    supports: {
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      max_tokens: { min: 1, max: 8192, default: 4096 }, // 官方文档：默认4K，最大8K
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      stop_sequences: { max_count: 4 },
      thinking: false,
      tools: true, // 支持 Function Calling
      vision: false, // 当前版本不支持视觉
      system_instructions: true,
      documents: false,
      structured_output: true // 支持 JSON Output
    }
  },

  // DeepSeek Reasoner - 推理模型
  'deepseek-reasoner': {
    provider: LLMProvider.DEEPSEEK,
    apiModel: 'deepseek-reasoner',
    isReasoner: true,
    knowledgeCutoff: '知识截断2024-7', // 基于最新DeepSeek推理模型推断
    supports: {
      // 注意：temperature、top_p、presence_penalty、frequency_penalty 对推理模型不生效
      temperature: { min: 0, max: 2, default: 1 },
      top_p: { min: 0, max: 1, default: 1 },
      presence_penalty: { min: -2, max: 2, default: 0 },
      frequency_penalty: { min: -2, max: 2, default: 0 },
      
      // 推理模型特有配置
      max_tokens: { min: 1, max: 65536, default: 32768 }, // 官方文档：默认32K，最大64K
      thinking: {
        enabled: true,
        budget_tokens: { min: 1000, max: 65536, default: 32768 },
        include_thoughts: true
      },
      
      // 功能支持
      tools: true, // 支持 Function Calling
      vision: false, // 不支持视觉
      system_instructions: true,
      documents: false,
      structured_output: true, // 支持 JSON Output
      reasoning: true, // 推理功能
      
      stop_sequences: { max_count: 4 }
    }
  }
}; 