import React, { useState, useEffect } from 'react';
import { LLMProviderInfo, ModelInfo } from '../interfaces';
import { MODEL_MAPPING } from '../utils/llmProviders'; // Import MODEL_MAPPING

// Dynamically generate MODEL_PROVIDERS and MODELS_BY_PROVIDER from MODEL_MAPPING
const providerNames: Record<string, string> = {
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  gpt: 'GPT',
  claude: 'Claude',
  grok: 'Grok',
};

const uniqueProviderIds = [...new Set(Object.values(MODEL_MAPPING).map(m => m.provider))];

const MODEL_PROVIDERS: LLMProviderInfo[] = uniqueProviderIds.map(id => ({
  id,
  name: providerNames[id] || id.charAt(0).toUpperCase() + id.slice(1) // Fallback name
}));

const MODELS_BY_PROVIDER: Record<string, ModelInfo[]> = {};
for (const [key, modelDetails] of Object.entries(MODEL_MAPPING)) {
  if (!MODELS_BY_PROVIDER[modelDetails.provider]) {
    MODELS_BY_PROVIDER[modelDetails.provider] = [];
  }
  // Attempt to create a somewhat descriptive label if not available directly
  // This assumes the key in MODEL_MAPPING (e.g., 'gpt-4o') can serve as a base for the label.
  // You might want a more sophisticated way to generate labels or add them to MODEL_MAPPING.
  let label = key.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  if (modelDetails.isReasoner) {
    label += ' (Reasoner)';
  }
  // Use the model key as the value, and the generated label as the label
  MODELS_BY_PROVIDER[modelDetails.provider].push({ value: key, label: label });
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabledProviders?: string[];
}

export default function ModelSelector({ value, onChange, disabledProviders = [] }: ModelSelectorProps) {
  const getInitialProvider = (): string => {
    for (const [provider, models] of Object.entries(MODELS_BY_PROVIDER)) {
      if (models.some(m => m.value === value)) {
        return provider;
      }
    }
    // Fallback to the provider of the first available model if current `value` isn't in any known provider list
    // This can happen if `DEFAULT_MODEL` in index.tsx is not in the first provider's list here.
    const firstProviderWithModels = Object.keys(MODELS_BY_PROVIDER)[0] || 'deepseek';
    return firstProviderWithModels;
  };

  const [selectedProvider, setSelectedProvider] = useState<string>(getInitialProvider());
  
  // Ensure availableModels is initialized correctly based on selectedProvider
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
    MODELS_BY_PROVIDER[selectedProvider] || []
  );

  // Effect to update selectedProvider and availableModels if the `value` prop changes externally
  // and is not consistent with the current selectedProvider.
  useEffect(() => {
    const newProvider = getInitialProvider();
    if (newProvider !== selectedProvider) {
      setSelectedProvider(newProvider);
      setAvailableModels(MODELS_BY_PROVIDER[newProvider] || []);
    }
  }, [value]); // Rerun when `value` (current selected model) changes

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const newModels = MODELS_BY_PROVIDER[providerId] || [];
    setAvailableModels(newModels);
    
    // If current model `value` is not in the new provider's list, auto-select the first model of the new provider.
    if (!newModels.some(m => m.value === value) && newModels.length > 0) {
      onChange(newModels[0].value);
    }
  };

  const isProviderDisabled = (providerId: string): boolean => {
    return disabledProviders.includes(providerId);
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <span className="text-sm text-gray-400">模型：</span>
      
      <div className="flex flex-wrap gap-2 mb-2 sm:mb-0">
        {MODEL_PROVIDERS.map(provider => {
          const isDisabled = isProviderDisabled(provider.id);
          return (
            <button
              key={provider.id}
              onClick={() => !isDisabled && handleProviderChange(provider.id)}
              disabled={isDisabled}
              className={`px-3 py-1 text-sm rounded-lg transition-colors
                ${selectedProvider === provider.id 
                  ? 'bg-[#2563eb] text-white' 
                  : isDisabled 
                    ? 'bg-[#101624] text-gray-500 cursor-not-allowed' 
                    : 'bg-[#101624] text-[#7dd3fc] hover:bg-[#1e293b]'
                }
                border ${selectedProvider === provider.id ? 'border-[#7dd3fc]' : 'border-[#233056]'}`}
            >
              {provider.name}
              {isDisabled && ' (未接入)'}
            </button>
          );
        })}
      </div>
      
      <select
        className="rounded-lg border px-3 py-1 bg-[#101624] text-[#7dd3fc] border-[#233056] focus:ring-2 focus:ring-[#2563eb] w-full sm:w-auto"
        value={value} // Ensure this value is one of the option values for the selected provider
        onChange={e => onChange(e.target.value)}
        disabled={isProviderDisabled(selectedProvider) || availableModels.length === 0}
      >
        {availableModels.map(model => (
          <option 
            key={model.value} 
            value={model.value} 
            disabled={model.disabled} // Individual model disable flag (not currently used, but good for future)
          >
            {model.label}
          </option>
        ))}
         {availableModels.length === 0 && isProviderDisabled(selectedProvider) && (
            <option value="" disabled>该提供商未接入</option>
        )}
        {availableModels.length === 0 && !isProviderDisabled(selectedProvider) && (
            <option value="" disabled>无可用模型</option> // Should ideally not happen if provider enabled
        )}
      </select>
    </div>
  );
} 