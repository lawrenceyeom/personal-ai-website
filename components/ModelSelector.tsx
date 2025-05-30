import React, { useState, useEffect, useMemo } from 'react';
import { LLMProviderInfo, ModelInfo } from '../interfaces';
import { 
  getProviderInfo, 
  getModelsByProvider, 
  getModelInfo,
  getAllAvailableModels,
  LLMProvider 
} from '../utils/llm'; // 使用新的模块化架构

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabledProviders?: string[];
}

// 提供商显示名称映射
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  [LLMProvider.DEEPSEEK]: 'DeepSeek',
  [LLMProvider.OPENAI]: 'OpenAI',
  [LLMProvider.GOOGLE]: 'Google',
  [LLMProvider.ANTHROPIC]: 'Anthropic',
  [LLMProvider.XAI]: 'xAI'
};

// 生成模型的显示标签
function generateModelLabel(modelName: string): string {
  const modelInfo = getModelInfo(modelName);
  
  // 基础标签生成
  let label = modelName
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // 添加特殊标记
  const tags: string[] = [];
  
  if (modelInfo?.isReasoner) {
    tags.push('推理');
  }
  if (modelInfo?.supports?.vision) {
    tags.push('视觉');
  }
  if (modelInfo?.supports?.tools) {
    tags.push('工具');
  }
  if (modelName.includes('mini') || modelName.includes('small')) {
    tags.push('轻量');
  }
  
  if (tags.length > 0) {
    label += ` (${tags.join(', ')})`;
  }
  
  return label;
}

export default function ModelSelector({ value, onChange, disabledProviders = [] }: ModelSelectorProps) {
  // 动态获取提供商和模型信息
  const providerInfo = useMemo(() => getProviderInfo(), []);
  const modelsByProvider = useMemo(() => getModelsByProvider(), []);
  
  // 构建提供商列表
  const availableProviders: LLMProviderInfo[] = useMemo(() => {
    return providerInfo.available.map(provider => ({
      id: provider,
      name: PROVIDER_DISPLAY_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
    }));
  }, [providerInfo]);

  // 按提供商分组的模型信息
  const modelsByProviderWithInfo = useMemo(() => {
    const result: Record<string, ModelInfo[]> = {};
    
    for (const [provider, models] of Object.entries(modelsByProvider)) {
      result[provider] = models.map(modelName => ({
        value: modelName,
        label: generateModelLabel(modelName),
        disabled: false
      }));
      
      // 按模型类型排序（推理模型在前，然后是旗舰模型，最后是其他）
      result[provider].sort((a, b) => {
        const modelInfoA = getModelInfo(a.value);
        const modelInfoB = getModelInfo(b.value);
        
        // 推理模型优先
        if (modelInfoA?.isReasoner && !modelInfoB?.isReasoner) return -1;
        if (!modelInfoA?.isReasoner && modelInfoB?.isReasoner) return 1;
        
        // 旗舰模型其次
        const isGeneralA = a.value.includes('4o') || a.value.includes('v3') || a.value.includes('4.1');
        const isGeneralB = b.value.includes('4o') || b.value.includes('v3') || b.value.includes('4.1');
        
        if (isGeneralA && !isGeneralB) return -1;
        if (!isGeneralA && isGeneralB) return 1;
        
        // 字母顺序
        return a.label.localeCompare(b.label);
      });
    }
    
    return result;
  }, [modelsByProvider]);

  const getInitialProvider = (): string => {
    // 首先检查当前模型属于哪个提供商
    for (const [provider, models] of Object.entries(modelsByProviderWithInfo)) {
      if (models.some(m => m.value === value)) {
        return provider;
      }
    }
    
    // 如果找不到，返回第一个有模型的提供商
    const firstProviderWithModels = Object.keys(modelsByProviderWithInfo)[0];
    return firstProviderWithModels || LLMProvider.DEEPSEEK;
  };

  const [selectedProvider, setSelectedProvider] = useState<string>(getInitialProvider());
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
    modelsByProviderWithInfo[selectedProvider] || []
  );

  // 当value改变时更新提供商
  useEffect(() => {
    const newProvider = getInitialProvider();
    if (newProvider !== selectedProvider) {
      setSelectedProvider(newProvider);
      setAvailableModels(modelsByProviderWithInfo[newProvider] || []);
    }
  }, [value, modelsByProviderWithInfo, selectedProvider]);

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const newModels = modelsByProviderWithInfo[providerId] || [];
    setAvailableModels(newModels);
    
    // 如果当前模型不在新提供商的列表中，自动选择第一个模型
    if (!newModels.some(m => m.value === value) && newModels.length > 0) {
      onChange(newModels[0].value);
    }
  };

  const isProviderDisabled = (providerId: string): boolean => {
    return disabledProviders.includes(providerId);
  };

  // 获取提供商统计信息
  const getProviderStats = (providerId: string) => {
    const stats = providerInfo.stats[providerId];
    const models = modelsByProviderWithInfo[providerId] || [];
    return {
      modelCount: models.length,
      available: stats?.available || false
    };
  };

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:gap-4 xl:gap-6">
      <span className="text-sm lg:text-base text-gray-400 font-medium whitespace-nowrap">AI 模型：</span>
      
      {/* 提供商选择器 */}
      <div className="flex flex-wrap gap-2 mb-2 sm:mb-0 lg:gap-3">
        {availableProviders.map(provider => {
          const isDisabled = isProviderDisabled(provider.id);
          const stats = getProviderStats(provider.id);
          const isSelected = selectedProvider === provider.id;
          
          return (
            <button
              key={provider.id}
              onClick={() => !isDisabled && handleProviderChange(provider.id)}
              disabled={isDisabled}
              className={`
                relative px-3 py-2 sm:px-4 lg:px-5 lg:py-2.5 text-sm lg:text-base rounded-lg transition-all duration-200 
                border-2 font-medium group
                ${isSelected 
                  ? 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white border-[#7dd3fc] shadow-lg' 
                  : isDisabled 
                    ? 'bg-[#0f172a] text-gray-500 border-gray-700 cursor-not-allowed opacity-60' 
                    : 'bg-[#101624] text-[#7dd3fc] border-[#233056] hover:bg-[#1e293b] hover:border-[#7dd3fc] hover:shadow-md'
                }
              `}
              title={isDisabled ? '该提供商未配置API密钥' : `${stats.modelCount} 个模型可用`}
            >
              <span className="flex items-center gap-2">
                {provider.name}
                {!isDisabled && (
                  <span className={`
                    inline-block w-2 h-2 rounded-full 
                    ${stats.available ? 'bg-green-400' : 'bg-amber-400'}
                  `} />
                )}
              </span>
              
              {!isDisabled && (
                <span className={`
                  absolute -top-1 -right-1 bg-[#7dd3fc] text-[#0f172a] 
                  text-xs rounded-full px-1.5 py-0.5 font-bold
                  ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  transition-opacity duration-200
                `}>
                  {stats.modelCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* 模型选择器 */}
      <div className="relative w-full sm:w-auto min-w-[200px] lg:min-w-[250px] xl:min-w-[300px]">
        <select
          className={`
            w-full px-4 py-2 lg:px-5 lg:py-2.5 rounded-lg border-2 bg-[#101624] text-[#7dd3fc] 
            border-[#233056] focus:ring-2 focus:ring-[#2563eb] focus:border-[#7dd3fc]
            transition-all duration-200 font-medium text-sm lg:text-base
            ${(isProviderDisabled(selectedProvider) || availableModels.length === 0) 
              ? 'opacity-60 cursor-not-allowed' 
              : 'hover:border-[#7dd3fc]'
            }
          `}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={isProviderDisabled(selectedProvider) || availableModels.length === 0}
        >
          {availableModels.map(model => {
            return (
              <option 
                key={model.value} 
                value={model.value} 
                disabled={model.disabled}
                className="bg-[#101624] text-[#7dd3fc]"
              >
                {model.label}
              </option>
            );
          })}
          
          {availableModels.length === 0 && isProviderDisabled(selectedProvider) && (
            <option value="" disabled className="bg-[#101624] text-gray-500">
              该提供商未配置 API 密钥
            </option>
          )}
          
          {availableModels.length === 0 && !isProviderDisabled(selectedProvider) && (
            <option value="" disabled className="bg-[#101624] text-gray-500">
              暂无可用模型
            </option>
          )}
        </select>
        
        {/* 模型信息提示 */}
        {value && (
          <div className="absolute top-full left-0 mt-1 text-xs text-gray-500 z-10">
            {(() => {
              const modelInfo = getModelInfo(value);
              const features = [];
              if (modelInfo?.isReasoner) features.push('🧠 推理');
              if (modelInfo?.supports?.vision) features.push('👁️ 视觉');
              if (modelInfo?.supports?.tools) features.push('🛠️ 工具');
              if (modelInfo?.supports?.structured_output) features.push('📋 结构化');
              
              const featureText = features.length > 0 ? features.join(' • ') : '';
              const knowledgeCutoff = modelInfo?.knowledgeCutoff;
              
              if (featureText && knowledgeCutoff) {
                return `${featureText} • 📅 ${knowledgeCutoff}`;
              } else if (featureText) {
                return featureText;
              } else if (knowledgeCutoff) {
                return `📅 ${knowledgeCutoff}`;
              }
              
              return '';
            })()}
          </div>
        )}
      </div>
    </div>
  );
} 