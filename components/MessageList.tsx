// MessageList.tsx
// 消息列表组件：深色卡片，用户/助手分色，头像渐变边框，字体更大，代码块深色
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import Clipboard from 'clipboard';
import { useEffect, useRef } from 'react';
import { Message } from '../interfaces';
import { LLMRequest } from '../utils/llm';
import { preprocessMath } from '../utils/mathProcessor';

interface MessageListProps {
  messages: Message[];
  onRegenerate?: (messageId: string, newModel?: string) => void;
  currentModel?: string;
}

export default function MessageList({ messages, onRegenerate, currentModel }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<{[key: string]: boolean}>({});
  const [showModelSelector, setShowModelSelector] = useState<{[key: string]: boolean}>({});
  const [selectedModels, setSelectedModels] = useState<{[key: string]: string}>({});
  
  // 挂载后为所有代码块添加一键复制功能
  useEffect(() => {
    const clipboard = new Clipboard('.copy-btn', {
      text: trigger => {
        const code = trigger.parentElement?.querySelector('code');
        return code ? code.textContent || '' : '';
      }
    });
    return () => clipboard.destroy();
  }, [messages]);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]); // 当消息列表变化时，自动滚动

  // 切换显示/隐藏思考过程
  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  // 切换显示/隐藏模型选择器
  const toggleModelSelector = (messageId: string) => {
    setShowModelSelector(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  // 重新生成回复
  const handleRegenerate = (messageId: string) => {
    if (onRegenerate) {
      const newModel = selectedModels[messageId] || currentModel;
      onRegenerate(messageId, newModel);
    }
  };

  // 更改选择的模型
  const handleModelChange = (messageId: string, model: string) => {
    setSelectedModels(prev => ({
      ...prev,
      [messageId]: model
    }));
  };

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      {messages.map(msg => {
        const isUser = msg.role === 'user';
        const hasThinking = !isUser && (msg.thinking || msg.isThinking);
        const isThinkingExpanded = expandedThinking[msg.id] || false;
        const showingModelSelector = showModelSelector[msg.id] || false;
        const selectedModel = selectedModels[msg.id] || currentModel;
        
        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
            <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3 max-w-[85%]`}>
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#0f172a] p-1 shadow">
                  <div className={`w-full h-full rounded-full ${!isUser && msg.isThinking ? 'animate-pulse' : ''} ${isUser ? 'bg-[#233056]' : 'bg-[#1e2333]'} flex items-center justify-center text-[#7dd3fc] font-bold text-lg`}>
                    {isUser ? '🧑' : '🤖'}
                  </div>
                </div>
              </div>
              
              {/* Message content */}
              <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* 思考过程按钮 */}
                {hasThinking && (
                  <button 
                    onClick={() => toggleThinking(msg.id)} 
                    className="flex items-center gap-1 text-sm text-[#7dd3fc] hover:text-white transition-colors self-start mb-1 px-3 py-1 rounded-lg bg-[#1c243b] border border-[#233056]"
                  >
                    <span className="inline-flex items-center">
                      {msg.isThinking && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#7dd3fc]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isThinkingExpanded ? '隐藏思路' : '显示思路'}
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${isThinkingExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                )}
                
                {/* 思考过程内容 */}
                {hasThinking && isThinkingExpanded && (
                  <div className="card relative border-2 border-[#3b4773] bg-[#1a1f35]/90 rounded-t-xl px-6 py-4 text-base text-gray-300">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeHighlight, rehypeKatex]}
                      components={{
                        // 表格组件
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4">
                            <table {...props} className="min-w-full border-collapse border border-[#233056] bg-[#101624] rounded-lg" />
                          </div>
                        ),
                        thead: ({ node, ...props }) => (
                          <thead {...props} className="bg-[#233056]" />
                        ),
                        tbody: ({ node, ...props }) => (
                          <tbody {...props} />
                        ),
                        tr: ({ node, ...props }) => (
                          <tr {...props} className="border-b border-[#233056] hover:bg-[#1a1f35]/50" />
                        ),
                        th: ({ node, ...props }) => (
                          <th {...props} className="border border-[#233056] px-4 py-2 text-left font-semibold text-[#7dd3fc] bg-[#1e2333]" />
                        ),
                        td: ({ node, ...props }) => (
                          <td {...props} className="border border-[#233056] px-4 py-2 text-gray-300" />
                        ),
                        pre: ({ node, children, ...props }) => {
                          const codeChild = React.Children.toArray(children).find(
                            (child) => React.isValidElement(child) && child.type === 'code'
                          ) as React.ReactElement<{ className?: string }> | undefined;
                          const codeClassName = codeChild?.props?.className || '';
                          const isCodeBlock = /language-(\w+)/.exec(codeClassName);
                          
                          // 检查是否是多行代码块（即使没有语言标识）
                          const codeContent = (codeChild?.props as any)?.children;
                          const isMultiLineCode = typeof codeContent === 'string' && 
                            (codeContent.includes('\n') || codeContent.length > 50);

                          if (isCodeBlock || isMultiLineCode) {
                            return (
                              <div className="relative group/code-block my-2 text-sm">
                                <button
                                  className="copy-btn absolute top-2 right-2 text-xs bg-[#233056] text-[#7dd3fc] px-2 py-1 rounded shadow hover:bg-[#2563eb] opacity-0 group-hover/code-block:opacity-100 transition border border-[#2563eb] z-10"
                                  title="复制代码"
                                >复制</button>
                                <pre {...props} className={(props.className || '') + " bg-[#101624] rounded-lg border border-[#233056] p-3 pr-16 overflow-x-auto relative"}>
                                  {children}
                                </pre>
                              </div>
                            );
                          }
                          return <pre {...props} className={(props.className || '') + " my-2 whitespace-pre-wrap text-white"}>{children}</pre>;
                        },
                        code: ({ node, inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          if (inline) {
                            return (
                              <code {...props} className={(className || '') + ' px-1 py-0.5 rounded bg-[#233056] text-[#7dd3fc] text-sm'}>
                                {children}
                              </code>
                            );
                          }
                          if (match) {
                            return (
                              <code {...props} className={(className || '') + ' text-[#7dd3fc]'}>
                                {children}
                              </code>
                            );
                          }
                          return <code {...props} className={(className || '') + ' text-base text-white'}>{children}</code>;
                        },
                        p: ({node, ...props}) => <p className="my-2 text-base text-white" {...props} />,
                      }}
                    >
                      {preprocessMath(msg.thinking || '正在思考中...')}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* 正文内容 */}
                <div className={`card relative px-7 py-5 flex flex-col gap-2 border-2 ${isUser ? 'border-[#2563eb] bg-[#233056]/90' : 'border-[#7dd3fc] bg-[#1e2333]/90'} ${isUser ? 'rounded-br-3xl' : isThinkingExpanded ? 'rounded-b-xl' : 'rounded-bl-3xl'} text-lg`}>
                  {/* 图片 */}
                  {msg.imageUrl && <img src={msg.imageUrl} alt="用户上传" className="mb-2 max-w-xs rounded-lg border border-[#233056]" />}
                  
                  {/* AI-generated image */}
                  {msg.aiImageData && (
                    <img 
                      src={`data:${msg.aiImageData.mime_type};base64,${msg.aiImageData.data}`}
                      alt="AI生成图片"
                      className="mb-2 max-w-md rounded-lg border border-[#7dd3fc] shadow-lg"
                    />
                  )}

                  {/* Markdown内容，代码块带复制 */}
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeKatex]}
                    components={{
                      // 表格组件
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table {...props} className="min-w-full border-collapse border border-[#233056] bg-[#101624] rounded-lg" />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead {...props} className="bg-[#233056]" />
                      ),
                      tbody: ({ node, ...props }) => (
                        <tbody {...props} />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr {...props} className="border-b border-[#233056] hover:bg-[#1a1f35]/50" />
                      ),
                      th: ({ node, ...props }) => (
                        <th {...props} className="border border-[#233056] px-4 py-2 text-left font-semibold text-[#7dd3fc] bg-[#1e2333]" />
                      ),
                      td: ({ node, ...props }) => (
                        <td {...props} className="border border-[#233056] px-4 py-2 text-white" />
                      ),
                                              pre: ({ node, children, ...props }) => {
                        const codeChild = React.Children.toArray(children).find(
                          (child) => React.isValidElement(child) && child.type === 'code'
                        ) as React.ReactElement<{ className?: string }> | undefined;
                        const codeClassName = codeChild?.props?.className || '';
                        const isCodeBlock = /language-(\w+)/.exec(codeClassName);
                        
                        // 检查是否是多行代码块（即使没有语言标识）
                        const codeContent = (codeChild?.props as any)?.children;
                        const isMultiLineCode = typeof codeContent === 'string' && 
                          (codeContent.includes('\n') || codeContent.length > 50);

                        if (isCodeBlock || isMultiLineCode) {
                          return (
                            <div className="relative group/code-block my-2 text-base">
                              <button
                                className="copy-btn absolute top-2 right-2 text-xs bg-[#233056] text-[#7dd3fc] px-2 py-1 rounded shadow hover:bg-[#2563eb] opacity-0 group-hover/code-block:opacity-100 transition border border-[#2563eb] z-10"
                                title="复制代码"
                              >复制</button>
                              <pre {...props} className={(props.className || '') + " bg-[#101624] rounded-lg border border-[#233056] p-3 pr-16 overflow-x-auto relative"}>
                                {children}
                              </pre>
                            </div>
                          );
                        }
                        return <pre {...props} className={(props.className || '') + " my-2 whitespace-pre-wrap text-white"}>{children}</pre>;
                      },
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        if (inline) {
                          return (
                            <code {...props} className={(className || '') + ' px-1 py-0.5 rounded bg-[#233056] text-[#7dd3fc] text-sm'}>
                              {children}
                            </code>
                          );
                        }
                        if (match) {
                          // Code block content (inside <pre> already handled by rehypeHighlight)
                          return (
                            <code {...props} className={(className || '') + ' text-[#7dd3fc]'}>
                              {children}
                            </code>
                          );
                        }
                        // Fallback for other <code> usages, if any, or if it's not inline and not a language block (should be rare)
                        return <code {...props} className={(className || '') + ' text-base text-white'}>{children}</code>;
                      },
                      // Ensure headings and paragraphs render with white text
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-4 text-white" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold my-3 text-white" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-semibold my-2 text-white" {...props} />,
                      h4: ({node, ...props}) => <h4 className="text-base font-semibold my-2 text-white" {...props} />,
                      h5: ({node, ...props}) => <h5 className="text-sm font-semibold my-2 text-white" {...props} />,
                      h6: ({node, ...props}) => <h6 className="text-xs font-semibold my-2 text-white" {...props} />,
                      p: ({node, ...props}) => <p className="my-2 text-base text-white" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside my-2 text-base text-white" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside my-2 text-base text-white" {...props} />,
                      li: ({node, ...props}) => <li className="my-1 text-white" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-white" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#7dd3fc] pl-4 my-4 text-white italic" {...props} />,
                    }}
                  >
                    {preprocessMath(msg.content)}
                  </ReactMarkdown>

                  {/* 重新生成和模型选择 - 仅对AI回复显示 */}
                  {!isUser && onRegenerate && !msg.isThinking && (
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[#233056]">
                      <button 
                        onClick={() => toggleModelSelector(msg.id)}
                        className="text-xs text-[#7dd3fc] hover:text-white transition-colors px-2 py-1 rounded-md bg-[#1c243b] border border-[#233056]"
                      >
                        {showingModelSelector ? '隐藏模型' : '切换模型'}
                      </button>
                      <button 
                        onClick={() => handleRegenerate(msg.id)}
                        className="flex items-center gap-1 text-xs text-white hover:text-[#7dd3fc] transition-colors px-2 py-1 rounded-md bg-[#2563eb] border border-[#233056]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重新生成
                      </button>
                    </div>
                  )}

                  {/* 模型选择下拉菜单 */}
                  {!isUser && showingModelSelector[msg.id] && (
                    <div className="flex flex-col mt-2 bg-[#1a1f35] rounded-md border border-[#233056] p-2">
                      <div className="text-xs text-gray-400 mb-2">选择模型重新生成回复:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          className={`text-xs px-2 py-1.5 rounded ${selectedModel === 'deepseek-chat' ? 'bg-[#2563eb] text-white' : 'bg-[#1c243b] text-[#7dd3fc] hover:bg-[#233056]'}`}
                          onClick={() => handleModelChange(msg.id, 'deepseek-chat')}
                        >
                          DeepSeek-V2
                        </button>
                        <button 
                          className={`text-xs px-2 py-1.5 rounded ${selectedModel === 'deepseek-reasoner' ? 'bg-[#2563eb] text-white' : 'bg-[#1c243b] text-[#7dd3fc] hover:bg-[#233056]'}`}
                          onClick={() => handleModelChange(msg.id, 'deepseek-reasoner')}
                        >
                          DeepSeek Coder
                        </button>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button 
                          onClick={() => handleRegenerate(msg.id)}
                          className="text-xs px-3 py-1 bg-[#2563eb] text-white rounded hover:bg-[#3b82f6]"
                        >
                          确认
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
} 