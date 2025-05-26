import React from 'react';
import TopBar from '../components/TopBar';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#101624] text-gray-300 flex flex-col">
      <TopBar />
      
      <div className="container mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-semibold text-[#7dd3fc] mb-6 border-b border-[#233056] pb-4">
          关于 Yao's AI
        </h1>
        
        <div className="bg-[#1a1f35] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-medium text-white mb-4">支持的模型</h2>
          <p className="mb-4">
            Yao's AI 是一个个人AI助手网站，支持连接多种大语言模型，让您可以与不同的AI进行对话并比较它们的回答。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[#7dd3fc] mb-2">DeepSeek</h3>
              <p className="text-sm mb-2">
                DeepSeek AI的开源及商业大语言模型，包括通用对话模型和代码及数学专精模型。
              </p>
              <ul className="list-disc list-inside text-sm mb-3">
                <li>DeepSeek Chat (V3): 高性能通用对话模型</li>
                <li>DeepSeek Reasoner (R1): 专为复杂推理（如代码和数学）设计</li>
              </ul>
              <p className="text-xs text-gray-400">
                <a 
                  href="https://platform.deepseek.com/"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#7dd3fc] hover:underline"
                >
                  获取DeepSeek API密钥 →
                </a>
              </p>
            </div>
            
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[#7dd3fc] mb-2">Google Gemini</h3>
              <p className="text-sm mb-2">
                Google开发的大型多模态AI模型系列，具备强大的多模态理解和生成能力。
              </p>
              <ul className="list-disc list-inside text-sm mb-3">
                <li>Gemini 2.5 Pro Preview: 最新一代预览模型，具备先进的推理和多模态能力</li>
                <li>Gemini 1.5 Pro: 功能全面的多模态模型</li>
                <li>Gemini 1.5 Flash: 更快速、经济高效的多模态模型</li>
              </ul>
              <p className="text-xs text-gray-400">
                <a 
                  href="https://aistudio.google.com/"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#7dd3fc] hover:underline"
                >
                  获取Gemini API密钥 →
                </a>
              </p>
            </div>
            
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[#7dd3fc] mb-2">OpenAI GPT</h3>
              <p className="text-sm mb-2">
                OpenAI推出的领先大语言模型系列，以其强大的文本生成和理解能力著称。
              </p>
              <ul className="list-disc list-inside text-sm mb-3">
                <li>GPT-4o: OpenAI当前最先进的多模态模型，速度更快，成本更低</li>
                <li>GPT-4o Mini: GPT-4o的更小、更经济高效版本</li>
                <li>GPT-4 Turbo: 具备强大能力的成熟模型</li>
              </ul>
              <p className="text-xs text-gray-400">
                <a 
                  href="https://platform.openai.com/api-keys"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#7dd3fc] hover:underline"
                >
                  获取OpenAI API密钥 →
                </a>
              </p>
            </div>
            
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-lg font-medium text-[#7dd3fc] mb-2">Anthropic Claude</h3>
              <p className="text-sm mb-2">
                Anthropic开发的Claude模型系列，专注于打造安全、有用且诚实的AI系统。
              </p>
              <ul className="list-disc list-inside text-sm mb-3">
                <li>Claude 3.5 Sonnet: 最新一代Sonnet模型，智能、速度和成本达到新的平衡</li>
                <li>Claude 3 Opus: Claude 3系列中最强大的模型，适用于复杂任务</li>
                <li>Claude 3 Sonnet (Older): Claude 3系列中平衡性能和速度的先前版本</li>
                <li>Claude 3 Haiku: Claude 3系列中最快、最紧凑的模型</li>
              </ul>
              <p className="text-xs text-gray-400">
                <a 
                  href="https://console.anthropic.com/"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#7dd3fc] hover:underline"
                >
                  获取Claude API密钥 →
                </a>
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#1a1f35] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-medium text-white mb-4">特色功能</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-base font-medium text-[#7dd3fc] mb-2">查看思考过程</h3>
              <p className="text-sm">
                支持查看AI的思考过程，让您了解AI如何一步步推理到最终答案。
              </p>
            </div>
            
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-base font-medium text-[#7dd3fc] mb-2">重新生成回复</h3>
              <p className="text-sm">
                针对单条回复，您可以请求AI使用相同或不同的模型重新生成回答。
              </p>
            </div>
            
            <div className="bg-[#1e2333] border border-[#233056] rounded-lg p-4">
              <h3 className="text-base font-medium text-[#7dd3fc] mb-2">多模型对比</h3>
              <p className="text-sm">
                在同一个对话中切换不同的AI模型，比较它们对同一问题的不同回答。
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-8">
          <Link href="/">
            <span className="inline-flex items-center bg-[#2563eb] hover:bg-[#1e40af] text-white px-4 py-2 rounded-md transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              开始体验
            </span>
          </Link>
        </div>
      </div>
      
      <footer className="bg-[#0f1525] text-gray-500 py-4 text-center text-sm">
        <p>© 2024 Yao's AI - 由Yao构建</p>
      </footer>
    </div>
  );
}
