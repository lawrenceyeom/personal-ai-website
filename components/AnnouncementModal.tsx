import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnnouncementModal({ isOpen, onClose }: AnnouncementModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭模态窗口
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden'; // 防止背景滚动

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Modal = () => (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* 模态窗口内容 */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-white">网站公告 & 功能介绍</h2>
            <span className="px-2 py-1 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-full border border-blue-600/30">
              v2.2.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)] custom-scrollbar">
          {/* 最新更新 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-400">🎉 最新更新 (2025年5月31日)</h3>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-400 font-semibold">🔍 搜索功能</span>
                  <span className="text-slate-300">集成Google搜索，智能结果解析，任意模型点击底部🔍即可搜索</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-purple-400 font-semibold">🔧 文件兼容性</span>
                  <span className="text-slate-300">修复多提供商文件上传兼容性，OpenAI和Gemini格式自动适配</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-amber-400 font-semibold">⚡ 架构优化</span>
                  <span className="text-slate-300">模块化LLM架构，提升可维护性和扩展性</span>
                </div>
              </div>
            </div>
          </div>

          {/* 核心功能 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-blue-400">🚀 核心功能</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <span className="text-blue-400">💬</span> 多模型对话
                </h4>
                <p className="text-sm text-slate-300">支持4大AI提供商的10+个模型，流式响应，推理过程可视化</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <span className="text-green-400">🔍</span> 智能搜索
                </h4>
                <p className="text-sm text-slate-300">Google搜索集成，结果智能解析和展示</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <span className="text-purple-400">📁</span> 文件处理
                </h4>
                <p className="text-sm text-slate-300">支持多种文档格式，图片处理，拖拽上传，多提供商兼容</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <span className="text-amber-400">💭</span> 推理模式
                </h4>
                <p className="text-sm text-slate-300">支持DeepSeek、Gemini、Grok，思考过程实时展示</p>
              </div>
            </div>
          </div>

          {/* 支持的AI模型 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-purple-400">🤖 支持的AI模型</h3>
            </div>
            <div className="space-y-4">
              {/* DeepSeek */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">D</span>
                    DeepSeek
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30">推理模式</span>
                    <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30">多模态</span>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mb-2">
                  <span className="font-medium">模型:</span> DeepSeek V3, DeepSeek Reasoner
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-medium">特点:</span> 超强推理能力，支持复杂逻辑思考，中文优化，思考过程可视化
                </div>
              </div>

              {/* OpenAI */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">O</span>
                    OpenAI GPT
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30">推理模式</span>
                    <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30">多模态</span>
                    <span className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded border border-purple-600/30">工具调用</span>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mb-2">
                  <span className="font-medium">模型:</span> GPT-4.1, o3-mini, GPT-4o, GPT-4o-mini
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-medium">特点:</span> 业界标杆，推理模型先驱，工具调用能力强，多模态性能优秀
                </div>
              </div>

              {/* Anthropic Claude */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold text-white">C</span>
                    Anthropic Claude(暂不支持)
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30">多模态</span>
                    <span className="px-2 py-1 text-xs bg-amber-600/20 text-amber-400 rounded border border-amber-600/30">长文本</span>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mb-2">
                  <span className="font-medium">模型:</span> Claude 3.5 Sonnet, Claude 4 Opus/Sonnet
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-medium">特点:</span> 安全对齐，长文本处理，代码能力强，思维清晰，回答详细
                </div>
              </div>

              {/* Google Gemini */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">G</span>
                    Google Gemini
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30">推理模式</span>
                    <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30">多模态</span>
                    <span className="px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded border border-emerald-600/30">搜索工具</span>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mb-2">
                  <span className="font-medium">模型:</span> Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash (Thinking)
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-medium">特点:</span> Google搜索集成，多模态能力强，推理模式，实时信息获取
                </div>
              </div>

              {/* xAI Grok */}
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-gradient-to-r from-gray-600 to-slate-600 flex items-center justify-center text-xs font-bold text-white">X</span>
                    xAI Grok
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30">多模态</span>
                    <span className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded border border-indigo-600/30">X平台数据</span>
                  </div>
                </div>
                <div className="text-sm text-slate-300 mb-2">
                  <span className="font-medium">模型:</span> Grok-3, Grok-3mini
                </div>
                <div className="text-sm text-slate-300">
                  <span className="font-medium">特点:</span> 实时X平台数据，幽默风格，创新思维，敢于挑战传统观点
                </div>
              </div>
            </div>
          </div>

          {/* 技术规格 */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-amber-600/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-amber-400">⚡ 技术规格</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">10+</div>
                <div className="text-sm text-slate-300">AI模型</div>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">5+</div>
                <div className="text-sm text-slate-300">文件格式</div>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">4</div>
                <div className="text-sm text-slate-300">AI提供商</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(<Modal />, document.body) : null;
} 