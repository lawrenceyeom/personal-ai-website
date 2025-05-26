import React, { useState, useEffect } from 'react';
import { MODEL_MAPPING } from '../utils/llmProviders';

interface AdvancedSettingsProps {
  selectedModel: string;
  settings: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    stop_sequences?: string[];
    seed?: number;
    thinking?: { budget_tokens?: number; type?: string };
    system?: string;
  };
  onChange: (settings: any) => void;
  onReset: () => void;
}

export default function AdvancedSettings({ 
  selectedModel, 
  settings, 
  onChange, 
  onReset 
}: AdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stopSequencesText, setStopSequencesText] = useState(
    settings.stop_sequences?.join(', ') || ''
  );

  const modelInfo = MODEL_MAPPING[selectedModel];
  const supports = modelInfo?.supports || {};

  // Update stop sequences text when settings change
  useEffect(() => {
    setStopSequencesText(settings.stop_sequences?.join(', ') || '');
  }, [settings.stop_sequences]);

  const handleChange = (key: string, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  const handleStopSequencesChange = (text: string) => {
    setStopSequencesText(text);
    const sequences = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const maxCount = supports.stop_sequences?.max_count || 4;
    const limitedSequences = sequences.slice(0, maxCount);
    handleChange('stop_sequences', limitedSequences.length > 0 ? limitedSequences : undefined);
  };

  const handleThinkingChange = (key: string, value: any) => {
    const newThinking = { ...settings.thinking, [key]: value };
    handleChange('thinking', newThinking);
  };

  const resetToDefaults = () => {
    const defaults: any = {};
    
    if (supports.temperature) {
      defaults.temperature = supports.temperature.default;
    }
    if (supports.top_p) {
      defaults.top_p = supports.top_p.default;
    }
    if (supports.top_k) {
      defaults.top_k = supports.top_k.default;
    }
    if (supports.max_tokens) {
      defaults.max_tokens = supports.max_tokens.default;
    }
    if (supports.presence_penalty) {
      defaults.presence_penalty = supports.presence_penalty.default;
    }
    if (supports.frequency_penalty) {
      defaults.frequency_penalty = supports.frequency_penalty.default;
    }

    onChange(defaults);
    onReset();
  };

  const renderSlider = (
    key: string,
    label: string,
    support: { min: number; max: number; default: number } | undefined,
    step: number = 0.1
  ) => {
    if (!support) return null;

    const value = settings[key as keyof typeof settings] as number || support.default;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-gray-300">{label}</label>
          <span className="text-sm text-[#7dd3fc] bg-[#101624] px-2 py-1 rounded border border-[#233056]">
            {value.toFixed(step === 1 ? 0 : 1)}
          </span>
        </div>
        <input
          type="range"
          min={support.min}
          max={support.max}
          step={step}
          value={value}
          onChange={(e) => handleChange(key, parseFloat(e.target.value))}
          className="w-full h-2 bg-[#233056] rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{support.min}</span>
          <span className="text-gray-400">默认: {support.default}</span>
          <span>{support.max}</span>
        </div>
      </div>
    );
  };

  if (!modelInfo) {
    return null;
  }

  return (
    <div className="bg-[#0f172a] border border-[#233056] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex justify-between items-center bg-[#101624] hover:bg-[#1e293b] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">高级设置</span>
          <span className="text-xs text-gray-500">({selectedModel})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetToDefaults();
            }}
            className="text-xs text-[#7dd3fc] hover:text-white px-2 py-1 bg-[#2563eb] hover:bg-[#1d4ed8] rounded"
          >
            重置
          </button>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Temperature */}
          {renderSlider('temperature', '创造性 (Temperature)', supports.temperature)}

          {/* Top P */}
          {renderSlider('top_p', '核心采样 (Top P)', supports.top_p)}

          {/* Top K */}
          {renderSlider('top_k', 'Top K 采样', supports.top_k, 1)}

          {/* Max Tokens */}
          {renderSlider('max_tokens', '最大令牌数', supports.max_tokens, 1)}

          {/* Presence Penalty */}
          {renderSlider('presence_penalty', '存在惩罚', supports.presence_penalty)}

          {/* Frequency Penalty */}
          {renderSlider('frequency_penalty', '频率惩罚', supports.frequency_penalty)}

          {/* Stop Sequences */}
          {supports.stop_sequences && (
            <div className="space-y-2">
              <label className="text-sm text-gray-300">
                停止序列 (最多 {supports.stop_sequences.max_count} 个)
              </label>
              <input
                type="text"
                value={stopSequencesText}
                onChange={(e) => handleStopSequencesChange(e.target.value)}
                placeholder="用逗号分隔，例如: \n, END, STOP"
                className="w-full px-3 py-2 bg-[#101624] border border-[#233056] rounded-lg text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                输入文本序列，当模型生成这些序列时将停止响应
              </p>
            </div>
          )}

          {/* Thinking Parameters (for models that support it) */}
          {supports.thinking && (
            <div className="space-y-3 p-3 bg-[#1e293b] rounded-lg border border-[#334155]">
              <h4 className="text-sm font-medium text-[#7dd3fc]">思维链设置</h4>
              <div className="space-y-2">
                <label className="text-sm text-gray-300">思维预算令牌数</label>
                <input
                  type="number"
                  value={settings.thinking?.budget_tokens || 2000}
                  onChange={(e) => handleThinkingChange('budget_tokens', parseInt(e.target.value))}
                  min={100}
                  max={10000}
                  step={100}
                  className="w-full px-3 py-2 bg-[#101624] border border-[#233056] rounded-lg text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* System Instructions */}
          {supports.system_instructions && (
            <div className="space-y-2">
              <label className="text-sm text-gray-300">系统指令</label>
              <textarea
                value={settings.system || ''}
                onChange={(e) => handleChange('system', e.target.value)}
                placeholder="输入系统指令来定义AI的行为和角色..."
                rows={3}
                className="w-full px-3 py-2 bg-[#101624] border border-[#233056] rounded-lg text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Random Seed */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">随机种子 (可选)</label>
            <input
              type="number"
              value={settings.seed || ''}
              onChange={(e) => handleChange('seed', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="输入数字以获得可重现的结果"
              className="w-full px-3 py-2 bg-[#101624] border border-[#233056] rounded-lg text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              相同的种子和参数将产生相同的结果
            </p>
          </div>

          {/* Model Capabilities Info */}
          <div className="p-3 bg-[#1e293b] rounded-lg border border-[#334155]">
            <h4 className="text-sm font-medium text-[#7dd3fc] mb-2">模型能力</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${supports.tools ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                <span className="text-gray-300">工具调用</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${supports.vision ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                <span className="text-gray-300">图像理解</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${supports.thinking ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                <span className="text-gray-300">思维链</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${modelInfo.isReasoner ? 'bg-purple-500' : 'bg-gray-500'}`}></span>
                <span className="text-gray-300">推理模型</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7dd3fc;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7dd3fc;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
} 