// pages/index.tsx
// 主页：AI多模型对话主界面，包含模型切换、历史会话管理、流式对话、消息渲染等核心功能。
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MessageList from '../components/MessageList';
import ChatInput, { UploadedFile } from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import AdvancedSettings from '../components/AdvancedSettings';
import { LLMRequest, getModelMapping } from '../utils/llm';
import { Message, ChatSession } from '../interfaces';
import { processDocument, analyzeFileSupport, ProcessingResult, ProcessingStatus } from '../utils/fileProcessing';
import { isReasoningModel } from '../utils/llm';

// 使用新的getModelMapping函数获取模型映射
const MODEL_MAPPING = getModelMapping();

// Load sessions from localStorage
function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('chat_sessions') || '[]');
  } catch {
    return [];
  }
}

// Save sessions to localStorage
function saveSessions(sessions: ChatSession[]) {
  if (typeof window !== 'undefined') {
    try {
      const sessionsData = JSON.stringify(sessions);
      localStorage.setItem('chat_sessions', sessionsData);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, attempting to clean up old sessions...');
        
        // 尝试清理策略
        try {
          // 1. 首先删除已归档的会话
          const archivedSessions = sessions.filter(s => s.archived);
          if (archivedSessions.length > 0) {
            const cleanedSessions = sessions.filter(s => !s.archived);
            localStorage.setItem('chat_sessions', JSON.stringify(cleanedSessions));
            console.log(`Cleaned ${archivedSessions.length} archived sessions`);
            return;
          }
          
          // 2. 如果没有归档会话，删除最旧的非当前会话
          if (sessions.length > 10) {
            const sortedSessions = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
            const recentSessions = sortedSessions.slice(0, 10);
            localStorage.setItem('chat_sessions', JSON.stringify(recentSessions));
            console.log(`Kept only ${recentSessions.length} most recent sessions`);
            return;
          }
          
          // 3. 最后手段：清理会话中的长消息内容
          const compactSessions = sessions.map(session => ({
            ...session,
            messages: session.messages.map(msg => ({
              ...msg,
              content: typeof msg.content === 'string' && msg.content.length > 1000 
                ? msg.content.substring(0, 1000) + '...[truncated]'
                : msg.content,
              thinking: msg.thinking && msg.thinking.length > 500 
                ? msg.thinking.substring(0, 500) + '...[truncated]'
                : msg.thinking
            }))
          }));
          localStorage.setItem('chat_sessions', JSON.stringify(compactSessions));
          console.log('Compacted session data by truncating long messages');
          
        } catch (retryError) {
          console.error('Failed to clean up localStorage:', retryError);
          // 清理失败，清空所有会话数据
          localStorage.removeItem('chat_sessions');
          alert('存储空间不足，已清空历史会话。请刷新页面重新开始。');
        }
      } else {
        console.error('Error saving sessions:', error);
      }
    }
  }
}

const DEFAULT_MODEL = 'deepseek-chat';

export default function HomePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<LLMRequest['model']>(DEFAULT_MODEL);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Advanced settings state
  const [advancedSettings, setAdvancedSettings] = useState<{
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
  }>({});
  
  // 检查API key以确定哪些提供商应该被禁用
  // 只有配置了API key的提供商才会在UI中启用
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);
  
  // Ref for the abort controller to cancel API requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for available API keys to update UI for disabled providers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
        const newDisabled: string[] = [];
        
        // 提供商名称到设置键的映射（与getApiKeyForProvider保持一致）
        const providerToSettingsKey: { [key: string]: string } = {
          'openai': 'gpt',
          'anthropic': 'claude', 
          'google': 'gemini',
          'deepseek': 'deepseek',
          'xai': 'grok'
        };
        
        // 检查每个提供商的API key，如果没有则禁用
        Object.entries(providerToSettingsKey).forEach(([provider, settingsKey]) => {
          if (!savedKeys[settingsKey]) {
            newDisabled.push(provider);
          }
        });
        
        setDisabledProviders(newDisabled);

        // 检查localStorage使用情况
        try {
          const sessionsData = localStorage.getItem('chat_sessions');
          if (sessionsData) {
            const sizeInBytes = new Blob([sessionsData]).size;
            const sizeInMB = sizeInBytes / (1024 * 1024);
            
            // 估算localStorage配额（通常是5-10MB）
            const estimatedQuotaMB = 5;
            const usagePercentage = (sizeInMB / estimatedQuotaMB) * 100;
            
            console.log(`📊 LocalStorage usage: ${sizeInMB.toFixed(2)}MB (${usagePercentage.toFixed(1)}%)`);
            
            // 当使用超过80%时警告用户
            if (usagePercentage > 80) {
              console.warn('⚠️ LocalStorage usage high, consider clearing old sessions');
              
              // 当使用超过90%时显示用户提示
              if (usagePercentage > 90) {
                setTimeout(() => {
                  const shouldClean = confirm(
                    `存储空间使用率已达 ${usagePercentage.toFixed(1)}%\n\n` +
                    `为了避免数据丢失，建议清理一些旧的会话记录。\n\n` +
                    `是否现在清理已归档的会话？`
                  );
                  
                  if (shouldClean) {
                    const currentSessions = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
                    const cleanedSessions = currentSessions.filter((s: ChatSession) => !s.archived);
                    localStorage.setItem('chat_sessions', JSON.stringify(cleanedSessions));
                    location.reload(); // 刷新页面以加载清理后的数据
                  }
                }, 1000);
              }
            }
          }
        } catch (storageError) {
          console.error('Error checking localStorage usage:', storageError);
        }
        
      } catch (error) {
        console.error('Error reading API keys from localStorage for UI disable state:', error);
        // 如果localStorage损坏，禁用所有提供商
        setDisabledProviders(['openai', 'anthropic', 'google', 'xai']);
      }
    }
  }, []);

  // Load saved sessions on initial load
  useEffect(() => {
    const savedSessions = loadSessions();
    if (savedSessions.length > 0) {
      setSessions(savedSessions);
      // Set the most recent session as current
      const sortedSessions = [...savedSessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
      const activeSession = sortedSessions.find(s => !s.archived) || sortedSessions[0];
      setCurrentSessionId(activeSession.id);
      setModel(activeSession.model || DEFAULT_MODEL);
    } else {
      handleNewSession(); // Create a new session if none exist
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  // Current active session
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Update messages in the current session
  const updateSessionMessages = (messages: Message[]) => {
    if (currentSessionId) {
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === currentSessionId
            ? { ...s, messages, lastUpdated: Date.now() }
            : s
        )
      );
    }
  };
  
  // Add a new message to the current session
  const addMessageToCurrentSession = (message: Message) => {
    if (currentSessionId) {
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, message], lastUpdated: Date.now() }
            : s
        )
      );
    }
  };

  // Add a specific assistantMessage update to support thinking state
  const updateAssistantMessage = (sessionId: string, messageId: string, content: string, thinking?: string, isThinking: boolean = false) => {
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === messageId
                  ? { ...m, content, thinking, isThinking }
                  : m
              ),
              lastUpdated: Date.now()
            }
          : s
      )
    );
  };

  // Create a new chat session
  const handleNewSession = useCallback(() => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      name: 'New Chat',
      messages: [],
      model: model,
      lastUpdated: Date.now(),
      archived: false
    };
    setSessions(prevSessions => [...prevSessions, newSession]);
          setCurrentSessionId(newSessionId);
      setInput('');
      setUploadedImage(null);
      setUploadedFiles([]);
  }, [model]);

  // Switch to an existing session
  const handleSwitchSession = (sessionId: string) => {
    const switchedSession = sessions.find(s => s.id === sessionId);
    if (switchedSession) {
      setCurrentSessionId(sessionId);
      setModel(switchedSession.model || DEFAULT_MODEL);
      setInput('');
      setUploadedImage(null);
      setUploadedFiles([]);
    }
  };

  // Archive/Unarchive a session
  const handleArchiveSession = (sessionId: string) => {
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === sessionId
          ? { ...s, archived: !s.archived }
          : s
      )
    );
  };

  // Delete a session
  const handleDeleteSession = (sessionId: string) => {
    setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
    
    // If we deleted the current session, switch to another one
    if (sessionId === currentSessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        const activeSessions = remainingSessions.filter(s => !s.archived);
        const nextSession = activeSessions.length > 0 ? activeSessions[0] : remainingSessions[0];
        setCurrentSessionId(nextSession.id);
        setModel(nextSession.model || DEFAULT_MODEL);
      } else {
        // No sessions left, create a new one
        handleNewSession();
      }
    }
  };

  // Batch delete sessions
  const handleBatchDeleteSessions = (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;

    setSessions(prevSessions => {
      const filteredSessions = prevSessions.filter(s => !sessionIds.includes(s.id));
      
      // If current session was deleted, switch to another one
      if (sessionIds.includes(currentSessionId || '')) {
        if (filteredSessions.length > 0) {
          const activeSessions = filteredSessions.filter(s => !s.archived);
          const nextSession = activeSessions.length > 0 ? activeSessions[0] : filteredSessions[0];
          setTimeout(() => {
            setCurrentSessionId(nextSession.id);
            setModel(nextSession.model || DEFAULT_MODEL);
          }, 0);
        } else {
          // No sessions left, create a new one
          setTimeout(() => {
            handleNewSession();
          }, 0);
        }
      }
      
      return filteredSessions;
    });

    console.log(`✅ 批量删除了 ${sessionIds.length} 个会话`);
  };

  // Automatically summarize the conversation title
  const summarizeTitle = async (sessionId: string, messages: Message[]) => {
    if (messages.length < 2 || messages.length > 10) return; // Only summarize for reasonable length convos
    const conversationText = messages.slice(0, 5).map(m => `${m.role}: ${m.content}`).join('\n');
    
    // 🔧 优化：使用DeepSeek JSON输出功能，提供结构化的prompt
    const prompt = `Please analyze the following conversation and generate a concise title in JSON format.

CONVERSATION:
${conversationText}

Please output your response in JSON format with the following structure:

EXAMPLE JSON OUTPUT:
{
  "title": "Quantum Computing Basics",
  "description": "Discussion about quantum computing principles"
}

Requirements:
- title: Maximum 5 words, concise and descriptive
- description: Brief summary of the conversation topic
- Output must be valid JSON format`;
    
    // 🔧 修复：获取DeepSeek API密钥
    const deepseekApiKey = getApiKeyForProvider('deepseek');
    if (!deepseekApiKey) {
      console.warn('DeepSeek API密钥未配置，跳过标题总结');
      return;
    }

    // Get network options to pass to the API
    const currentNetworkOptions = getNetworkOptions();
    console.log('Using title summarization with JSON output, options:', currentNetworkOptions);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat', // Use DeepSeek for fast and reliable title generation
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3, // 🔧 优化：降低温度以获得更一致的JSON输出
          max_tokens: 100, // 🔧 优化：增加token数量以容纳JSON结构
          response_format: { type: 'json_object' }, // 🔧 新增：启用JSON输出模式
          apiKey: deepseekApiKey, // 🔧 修复：添加API密钥
          api_options: currentNetworkOptions
        }),
      });
      
      if (!response.ok) {
        console.error('Title summarization failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return;
      }
      
      const data = await response.json();
      console.log('Title summarization JSON response:', data);
      
      // 🔧 优化：解析JSON格式的响应
      if (data.title && typeof data.title === 'string') {
        const titleText = data.title.trim();
        console.log('✅ 从title字段获取标题:', titleText);
        setSessions(prevSessions =>
          prevSessions.map(s => (s.id === sessionId ? { ...s, name: titleText } : s))
        );
      } else if (data.content && typeof data.content === 'string') {
        // 解析content字段中的JSON
        try {
          const contentJson = JSON.parse(data.content);
          if (contentJson.title && typeof contentJson.title === 'string') {
            const titleText = contentJson.title.trim();
            console.log('✅ 从content中的JSON获取标题:', titleText);
            setSessions(prevSessions =>
              prevSessions.map(s => (s.id === sessionId ? { ...s, name: titleText } : s))
            );
          } else {
            // 如果JSON解析失败，使用content的前30个字符作为标题
            const fallbackTitle = data.content.trim().substring(0, 30);
            console.log('⚠️ JSON解析失败，使用fallback标题:', fallbackTitle);
            setSessions(prevSessions =>
              prevSessions.map(s => (s.id === sessionId ? { ...s, name: fallbackTitle } : s))
            );
          }
        } catch (jsonError) {
          console.error('❌ JSON解析失败:', jsonError);
          // 如果content本身就包含JSON格式，尝试直接提取title
          const titleMatch = data.content.match(/"title"\s*:\s*"([^"]+)"/);
          if (titleMatch) {
            const titleText = titleMatch[1].trim();
            console.log('✅ 从正则匹配获取标题:', titleText);
            setSessions(prevSessions =>
              prevSessions.map(s => (s.id === sessionId ? { ...s, name: titleText } : s))
            );
          } else {
            // 使用content的前30个字符作为标题
            const fallbackTitle = data.content.trim().substring(0, 30);
            console.log('⚠️ 使用fallback标题:', fallbackTitle);
            setSessions(prevSessions =>
              prevSessions.map(s => (s.id === sessionId ? { ...s, name: fallbackTitle } : s))
            );
          }
        }
      } else {
        console.error('❌ 响应中没有找到title或content字段');
      }
    } catch (error) {
      console.error('Error summarizing title:', error);
    }
  };

  // Let's update the handleSend function and regenerateMessage function to add API keys to requests
  const getApiKeyForProvider = (providerName: string): string | undefined => {
    if (typeof window !== 'undefined') {
      try {
        // 提供商名称到设置键的映射
        const providerToSettingsKey: { [key: string]: string } = {
          'openai': 'gpt',
          'anthropic': 'claude', 
          'google': 'gemini',
          'deepseek': 'deepseek',
          'xai': 'grok'
        };
        
        const settingsKey = providerToSettingsKey[providerName] || providerName;
        const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
        const apiKey = savedKeys[settingsKey];
        
        console.log(`[API Key Debug] Provider: ${providerName}, Settings Key: ${settingsKey}, Has Key: ${!!apiKey}`);
        
        return apiKey;
      } catch (error) {
        console.error('Error reading API keys:', error);
      }
    }
    return undefined;
  };

  // 获取网络设置选项
  const getNetworkOptions = (): { skipConnectionCheck: boolean, bypassProxy: boolean } => {
    if (typeof window !== 'undefined') {
      try {
        const savedOptions = JSON.parse(localStorage.getItem('api_options') || '{}');
        return {
          skipConnectionCheck: true, // Always skip connection check
          bypassProxy: savedOptions.bypassProxy || false
        };
      } catch (error) {
        console.error('Error reading network options:', error);
      }
    }
    return { skipConnectionCheck: true, bypassProxy: false }; // Default to skip if localStorage fails
  };

  // Add API key and network options to the request
  const addApiKeyToRequest = (req: LLMRequest): LLMRequest => {
    const modelInfo = MODEL_MAPPING[req.model];
    if (!modelInfo) return req;
    
    // 添加API密钥
    const apiKey = getApiKeyForProvider(modelInfo.provider);
    let updatedReq = { ...req };
    if (apiKey) {
      updatedReq.apiKey = apiKey;
    }
    
    // 添加网络设置选项
    const networkOptions = getNetworkOptions();
    updatedReq.api_options = networkOptions;
    
    return updatedReq;
  };

  // More substantially update the handleSend function to better handle thinking state
  const handleSend = async () => {
    if (!input.trim() && !uploadedImage) return;
    if (!currentSessionId || !currentSession) {
      console.error("No current session to send message to.");
      return;
    }

    setIsLoading(true);
    
    // Create and add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      ...(uploadedImage && { imageUrl: uploadedImage }),
    };

    // 处理上传的文件和图片
    let messageContent: string | any = input;
    
    // 添加文件内容到消息中
    if (uploadedFiles.length > 0) {
      let additionalContent = '';
      const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
      const textFiles = uploadedFiles.filter(f => f.content && !f.fileId && !f.fileUri);
      const nativeDocFiles = uploadedFiles.filter(f => f.fileId || f.fileUri);
      const otherFiles = uploadedFiles.filter(f => !f.type.startsWith('image/') && !f.content && !f.fileId && !f.fileUri);
      
      // 处理文本文件
      if (textFiles.length > 0) {
        additionalContent += '\n\n--- 上传的文件内容 ---\n';
        textFiles.forEach(file => {
          additionalContent += `\n[文件: ${file.name}]\n${file.content}\n`;
        });
      }
      
      // 处理原生文档文件（已上传到API的文件）
      if (nativeDocFiles.length > 0) {
        const modelInfo = MODEL_MAPPING[model];
        if (modelInfo?.supports?.documents) {
          // 对于支持原生文档处理的模型，需要根据不同提供商处理文件引用
          if (modelInfo.provider === 'google') {
            // Gemini需要使用fileData格式，而不是在文本中引用
            const fileDataParts = nativeDocFiles.filter(f => f.fileUri).map(file => ({
              fileData: {
                mimeType: file.type || 'application/pdf',
                fileUri: file.fileUri
              }
            }));
            
            // 构建多模态消息内容
            if (fileDataParts.length > 0) {
              messageContent = [
                { type: 'text', text: input },
                ...fileDataParts
              ];
            } else {
              // 如果没有有效的fileUri，仍然使用文本方式
              additionalContent += '\n\n--- 已上传文档 ---\n';
              nativeDocFiles.forEach(file => {
                if (file.fileUri) {
                  additionalContent += `[Gemini文件: ${file.name}, URI: ${file.fileUri}]\n`;
                }
              });
              messageContent = input + additionalContent;
            }
          } else if (modelInfo.provider === 'openai') {
            // OpenAI使用不同的文件引用格式
            additionalContent += '\n\n--- 已上传文档 ---\n';
            nativeDocFiles.forEach(file => {
              if (file.fileId) {
                additionalContent += `[OpenAI文件: ${file.name}, ID: ${file.fileId}]\n`;
              }
            });
            messageContent = input + additionalContent;
          } else {
            // 其他提供商的处理
            additionalContent += '\n\n--- 已上传文档 ---\n';
            nativeDocFiles.forEach(file => {
              if (file.fileId) {
                additionalContent += `[${modelInfo.provider}文件: ${file.name}, ID: ${file.fileId}]\n`;
              } else if (file.fileUri) {
                additionalContent += `[${modelInfo.provider}文件: ${file.name}, URI: ${file.fileUri}]\n`;
              }
            });
            messageContent = input + additionalContent;
          }
        } else {
          // 如果模型不支持，显示警告
          additionalContent += '\n\n--- 文档上传警告 ---\n';
          nativeDocFiles.forEach(file => {
            additionalContent += `[警告: ${file.name} 已上传但当前模型不支持原生文档处理]\n`;
          });
          messageContent = input + additionalContent;
        }
      }
      
      // 处理其他文件
      if (otherFiles.length > 0) {
        additionalContent += '\n\n--- 其他上传文件 ---\n';
        otherFiles.forEach(file => {
          additionalContent += `[文件: ${file.name}, 类型: ${file.type}, 大小: ${(file.size / 1024).toFixed(2)}KB]\n`;
        });
      }
      
      // 处理图片
      if (imageFiles.length > 0) {
        const modelInfo = MODEL_MAPPING[model];
        if (modelInfo?.supports?.vision) {
          // 对于支持视觉的模型，使用多模态格式
          const contentParts: any[] = [{ type: 'text', text: input + additionalContent }];
          imageFiles.forEach(file => {
            if (file.url) {
              contentParts.push({ type: 'image_url', image_url: { url: file.url } });
            }
          });
          messageContent = contentParts;
        } else {
          // 对于不支持视觉的模型，添加提示信息
          additionalContent += '\n\n[注意：当前模型不支持图像理解，已上传图片但无法分析]';
          messageContent = input + additionalContent;
        }
      } else {
        messageContent = input + additionalContent;
      }
    } else if (uploadedImage) {
      // 向后兼容旧的图片上传方式
      const modelInfo = MODEL_MAPPING[model];
      if (modelInfo?.supports?.vision) {
        messageContent = [
          { type: 'text', text: input },
          { type: 'image_url', image_url: { url: uploadedImage } }
        ];
      } else {
        messageContent = input + '\n\n[注意：当前模型不支持图像理解，图片已上传但无法分析]';
      }
    }
    
    addMessageToCurrentSession(userMessage);
    setInput('');
    setUploadedImage(null);
    setUploadedFiles([]);

    // Create initial assistant message with thinking state
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      thinking: '', // Initial empty thinking content
      isThinking: true, // Indicate that thinking is in progress
    };
    
    // Add the assistant message with initial thinking state
    addMessageToCurrentSession(assistantMessagePlaceholder);

    abortControllerRef.current = new AbortController();
    let accumulatedResponse = '';
    let reasoningBuffer = ''; // Start with empty reasoning buffer

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(
          addApiKeyToRequest({
            model: currentSession.model || model,
            messages: [
              ...currentSession.messages.filter(m => m.id !== assistantMessageId)
                .map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: messageContent }
            ],
            stream: true,
            ...advancedSettings,
          } as LLMRequest)
        ),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // 添加浏览器兼容性检查
      if (!response.body.getReader) {
        throw new Error('ReadableStream not supported in this environment');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = ''; // NEW buffer to handle partial SSE chunks
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (!isLoading) break; // Already handled by finish_reason or error
          
          // Final update when stream is done - mark thinking as complete
          updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, false);
          
          setIsLoading(false);
          if (currentSessionId && currentSession && currentSession.messages.length > 0) {
            summarizeTitle(currentSessionId, currentSession.messages);
          }
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        sseBuffer += chunkText; // append new chunk to buffer

        let delimiterIndex;
        while ((delimiterIndex = sseBuffer.indexOf('\n\n')) !== -1) {
          const eventText = sseBuffer.slice(0, delimiterIndex);
          sseBuffer = sseBuffer.slice(delimiterIndex + 2); // keep rest

          if (!eventText.startsWith('data: ')) continue;
          const jsonData = eventText.substring(6).trim();

          if (jsonData === '[DONE]' || jsonData.includes('"type":"done_event"')) {
            updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, false);
            setIsLoading(false);
            if (currentSessionId && currentSession && currentSession.messages.length > 0) {
              summarizeTitle(currentSessionId, currentSession.messages);
            }
            return;
          }

          try {
            const parsedSSE = JSON.parse(jsonData);
            
            // Handle direct thinking data from Gemini (new format)
            if (parsedSSE.thinking) {
              // Gemini思考内容直接处理
              reasoningBuffer += `${parsedSSE.thinking}\n`;
              updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.content) {
              // Regular content to display in the message
              accumulatedResponse += parsedSSE.content;
              
              // Update the message with new content, preserve thinking state
              updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.reasoning_content) {
              // Add reasoning content to the reasoning buffer
              reasoningBuffer += parsedSSE.reasoning_content + "\n";
              
              // Update the message with new thinking content but keep isThinking true
              updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.error) {
              console.error("SSE Error Chunk:", parsedSSE.error, parsedSSE.details);
              accumulatedResponse += `\n\n[Error: ${parsedSSE.error}]`;
              
              // Update with error and mark thinking as complete
              updateAssistantMessage(
                currentSessionId, 
                assistantMessageId, 
                accumulatedResponse, 
                reasoningBuffer + `Error: ${parsedSSE.error}\n`, 
                false
              );
              
              setIsLoading(false);
              return; // Stop processing on error
            } else if (parsedSSE.finish_reason) {
              // When we get a finish reason, mark thinking as complete
              updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, false);
              
              setIsLoading(false);
              if (currentSessionId && currentSession && currentSession.messages.length > 0) {
                summarizeTitle(currentSessionId, currentSession.messages);
              }
            } else {
              // Legacy format handling with {type, data}
              const { type: stepType, data: eventData } = parsedSSE;
              
              if (eventData && eventData.error) {
                console.error("SSE Error Chunk:", eventData.error, eventData.details);
                accumulatedResponse += `\n\n[Error: ${eventData.error}]`;
                
                // Update with error and mark thinking as complete
                updateAssistantMessage(
                  currentSessionId, 
                  assistantMessageId, 
                  accumulatedResponse, 
                  reasoningBuffer + `Error: ${eventData.error}\n`, 
                  false
                );
                
                setIsLoading(false);
                return; // Stop processing on error
              }

              // Process different types of chunks
              if (stepType === 'thinking_step' && eventData.thinking) {
                // Gemini的思考内容（使用thinking字段）
                reasoningBuffer += `${eventData.thinking}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'thinking_step' && eventData.content) {
                // Add to reasoning buffer when we get thinking steps
                reasoningBuffer += `${eventData.content}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'thinking_step' && eventData.reasoning_content) {
                // Add to reasoning buffer when we get reasoning content
                reasoningBuffer += `${eventData.reasoning_content}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'step' && eventData.content) {
                // DeepSeek reasoner's steps
                reasoningBuffer += `Step: ${eventData.content}\n`;
                
                // Update the message with new thinking content
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
                
              } else if (stepType === 'tool_use_step' && eventData) {
                // Format tool use information for reasoning display
                let toolInfo = 'Tool Invocation:\n';
                if(eventData.tool_name) toolInfo += `  Name: ${eventData.tool_name}\n`;
                if(eventData.tool_id) toolInfo += `  ID: ${eventData.tool_id}\n`;
                if(eventData.tool_input) toolInfo += `  Input: ${JSON.stringify(eventData.tool_input, null, 2)}\n`;
                if(eventData.tool_arguments) toolInfo += `  Arguments: ${JSON.stringify(eventData.tool_arguments, null, 2)}\n`;
                if(eventData.tool_arguments_raw) toolInfo += `  Arguments (raw): ${eventData.tool_arguments_raw}\n`;
                
                reasoningBuffer += toolInfo;
                
                // Update the message with new thinking content
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
                
              } else if (stepType === 'content_chunk' && eventData.content) {
                // Regular content to display in the message
                accumulatedResponse += eventData.content;
                
                // Update the message with new content, preserve thinking state
                updateAssistantMessage(currentSessionId, assistantMessageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'image_data') {
                console.log('Received image_data chunk:', eventData.content);
                // This is AI-generated image data
                const parsedImageData = JSON.parse(eventData.content);
                if (parsedImageData.image_data) {
                  // Find the last assistant message and update it with image data
                  setSessions(prevSessions =>
                    prevSessions.map(s => {
                      if (s.id === currentSessionId) {
                        const lastMsgIndex = s.messages.length - 1;
                        if (lastMsgIndex >= 0 && s.messages[lastMsgIndex].role === 'assistant') {
                          const updatedMessages = [...s.messages];
                          updatedMessages[lastMsgIndex] = {
                            ...updatedMessages[lastMsgIndex],
                            aiImageData: parsedImageData.image_data,
                            isThinking: false // Image received, no longer just thinking
                          };
                          return { ...s, messages: updatedMessages, lastUpdated: Date.now() };
                        }
                      }
                      return s;
                    })
                  );
                }
              }
            }
          } catch (e) {
            console.error('Error parsing SSE JSON data:', jsonData, e);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted by user.');
        // Update message to show cancelled state
        updateAssistantMessage(
          currentSessionId, 
          assistantMessageId, 
          "[Cancelled by user]", 
          reasoningBuffer + "\nRequest Cancelled by User.\n", 
          false
        );
      } else {
        console.error('Error sending message:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          userAgent: navigator.userAgent,
          uploadedFilesCount: uploadedFiles.length,
          hasUploadedImage: !!uploadedImage
        });
        const errorMessage = `Error: ${error.message || 'Failed to get response.'}`;
        
        // Update message with error and mark thinking as complete
        updateAssistantMessage(
          currentSessionId, 
          assistantMessageId, 
          errorMessage, 
          reasoningBuffer + errorMessage + `\n`, 
          false
        );
      }
      setIsLoading(false);
    }
  };
  
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      
      // Update the last assistant message to indicate cancellation
      if (currentSessionId && currentSession) {
        const lastMessage = currentSession.messages[currentSession.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          updateAssistantMessage(
            currentSessionId,
            lastMessage.id,
            "[Cancelled by user]",
            (lastMessage.thinking || '') + "\nRequest Cancelled by User.\n",
            false
          );
        }
      }
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const newFile: UploadedFile = {
        id: `img-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: result
      };
      setUploadedFiles(prev => [...prev, newFile]);
      setUploadedImage(result); // Keep for backward compatibility
      console.log('Image uploaded:', file.name, file.type, 'Size:', file.size);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (file: File) => {
    try {
      // 导入增强的文件处理工具
      const { 
        processDocument, 
        analyzeFileSupport, 
        generateUploadRecommendation,
        isFileSizeAcceptable,
        isFileFormatSupported
      } = await import('../utils/fileProcessing');
      
      // 获取当前模型信息
      const modelInfo = MODEL_MAPPING[model];
      const provider = String(modelInfo?.provider || 'unknown').toLowerCase();
      
      console.log('🔍 handleFileUpload Debug:', {
        model,
        modelInfo,
        originalProvider: modelInfo?.provider,
        convertedProvider: provider,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          sizeMB: (file.size / 1024 / 1024).toFixed(2)
        }
      });
      
      // 0. 首先检查当前模型是否支持文档处理
      if (!modelInfo?.supports?.documents) {
        const shouldSwitch = confirm(
          `当前模型 ${model} 不支持文档处理功能。\n\n` +
          `推荐切换到支持文档的模型：\n` +
          `• GPT-4.1 (OpenAI旗舰模型)\n` +
          `• GPT-4o 或 GPT-4o-mini (多模态模型)\n` +
          `• Gemini 2.5 Pro/Flash (Google模型)\n\n` +
          `是否要继续进行本地文本提取？`
        );
        
        if (!shouldSwitch) {
          return;
        }
        
        // 用户选择继续，但只能进行本地处理
        console.log('⚠️ 用户选择在不支持文档的模型上进行本地处理');
      }
      
      // 1. 首先检查文件格式支持
      const formatCheck = isFileFormatSupported(file, provider);
      if (!formatCheck.supported) {
        const shouldContinue = confirm(`${formatCheck.reason}\n\n${formatCheck.recommendation}\n\n是否仍要尝试本地文本提取？`);
        if (!shouldContinue) {
          return;
        }
      }
      
      // 2. 然后检查文件大小
      const fileSizeMB = file.size / 1024 / 1024;
      const maxSize = 32; // OpenAI的最大限制
      
      console.log('🔍 文件大小检查:', {
        fileSizeMB: fileSizeMB.toFixed(2),
        maxSize,
        provider,
        fileType: file.type
      });
      
      const sizeAcceptable = isFileSizeAcceptable(file, provider, maxSize);
      console.log('🔍 文件大小检查结果:', sizeAcceptable);
      
      if (!sizeAcceptable) {
        // 根据提供商给出具体的大小限制提示
        let errorMessage = `文件太大！文件大小：${fileSizeMB.toFixed(1)}MB\n\n`;
        
        if (provider === 'openai' || provider === 'gpt') {
          errorMessage += `OpenAI支持的文档最大32MB`;
        } else if (provider === 'gemini' || provider === 'google') {
          errorMessage += `Gemini内联文档最大20MB，大文件可使用File API`;
        } else {
          errorMessage += `当前模型最大支持${maxSize}MB的文件`;
        }
        
        alert(errorMessage);
        return;
      }
      
      // 3. 分析文件支持情况
      const supportAnalysis = analyzeFileSupport(file, provider);
      console.log('File support analysis:', supportAnalysis);
      
      // 生成上传建议并显示给用户
      const recommendation = generateUploadRecommendation(file, provider);
      console.log('Upload recommendation:', recommendation);
      
      // 根据分析结果选择处理方式
      if (supportAnalysis.supported && supportAnalysis.method === 'native' && modelInfo?.supports?.documents) {
        // 原生文档处理
        try {
          const apiKey = getApiKeyForProvider(modelInfo.provider);
          if (!apiKey) {
            alert(`请先设置${modelInfo.provider}的API密钥才能使用文档处理功能`);
            return;
          }
          
          // 显示上传进度提示
          const uploadingFile: UploadedFile = {
            id: `uploading-${Date.now()}`,
            name: file.name,
            type: file.type,
            size: file.size,
            content: `🔄 正在上传到${provider}...`,
            provider: provider
          };
          setUploadedFiles(prev => [...prev, uploadingFile]);
          
          // 创建FormData上传文件
          const formData = new FormData();
          formData.append('file', file);
          formData.append('model', model);
          formData.append('apiKey', apiKey);
          
          const uploadResponse = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || '文件上传失败');
          }
          
          const uploadResult = await uploadResponse.json();
          
          // 更新文件状态为成功
          const successFile: UploadedFile = {
            id: `file-${Date.now()}`,
            name: file.name,
            type: file.type,
            size: file.size,
            content: `✅ [${provider}原生文档] ${file.name}\n\n文件已成功上传到${provider}的文档处理服务`,
            // 存储文件引用信息
            fileId: uploadResult.fileId,
            fileUri: uploadResult.fileUri,
            provider: uploadResult.provider
          };
          
          // 移除上传中的文件，添加成功的文件
          setUploadedFiles(prev => 
            prev.filter(f => f.id !== uploadingFile.id).concat(successFile)
          );
          
          console.log('✅ File uploaded to API:', file.name, 'Provider:', provider);
          
        } catch (error: any) {
          console.error('❌ Error uploading file to API:', error);
          
          // 移除上传中的文件
          setUploadedFiles(prev => prev.filter(f => f.id.startsWith('uploading-')));
          
          // 询问用户是否回退到本地处理
          const shouldFallback = confirm(`文档上传失败: ${error.message}\n\n是否尝试本地文本提取？`);
          
          if (shouldFallback) {
            // 回退到本地处理
            const processingResult = await processDocument(file, provider);
            
            let content = processingResult.file.content || '';
            if (processingResult.warnings && processingResult.warnings.length > 0) {
              content += `\n\n⚠️ 处理警告:\n${processingResult.warnings.join('\n')}`;
            }
            if (processingResult.errors && processingResult.errors.length > 0) {
              content += `\n\n❌ 处理错误:\n${processingResult.errors.join('\n')}`;
            }
            
            const newFile: UploadedFile = {
              id: `file-${Date.now()}`,
              name: processingResult.file.name,
              type: processingResult.file.type,
              size: processingResult.file.size,
              content: `⚠️ [本地处理] ${content}`
            };
            setUploadedFiles(prev => [...prev, newFile]);
            console.log('📄 File processed locally:', file.name, file.type, 'Size:', file.size);
            
            // 根据处理状态给出反馈
            if (processingResult.status === 'success') {
              console.log('✅ 文件处理成功');
            } else if (processingResult.status === 'partial') {
              setTimeout(() => {
                alert(`⚠️ 文件部分处理成功。\n\n${processingResult.warnings?.join('\n') || ''}`);
              }, 100);
            } else if (processingResult.status === 'failed') {
              setTimeout(() => {
                alert(`❌ 文件处理失败。\n\n${processingResult.errors?.join('\n') || ''}`);
              }, 100);
            }
            
            // 如果是因为提供商不支持，给出建议
            if (!supportAnalysis.supported) {
              setTimeout(() => {
                alert(`${recommendation}\n\n文件已进行本地文本提取，但可能无法获得最佳效果。`);
              }, 100);
            }
          }
        }
      } else {
        // 本地处理（文本提取或不支持的提供商）
        const processingResult = await processDocument(file, provider);
        
        let content = processingResult.file.content || '';
        if (processingResult.warnings && processingResult.warnings.length > 0) {
          content += `\n\n⚠️ 处理警告:\n${processingResult.warnings.join('\n')}`;
        }
        if (processingResult.errors && processingResult.errors.length > 0) {
          content += `\n\n❌ 处理错误:\n${processingResult.errors.join('\n')}`;
        }
        
        const newFile: UploadedFile = {
          id: `file-${Date.now()}`,
          name: processingResult.file.name,
          type: processingResult.file.type,
          size: processingResult.file.size,
          content: `⚠️ [本地处理] ${content}`
        };
        setUploadedFiles(prev => [...prev, newFile]);
        console.log('📄 File processed locally:', file.name, file.type, 'Size:', file.size);
        
        // 根据处理状态给出反馈
        if (processingResult.status === 'success') {
          console.log('✅ 文件处理成功');
        } else if (processingResult.status === 'partial') {
          setTimeout(() => {
            alert(`⚠️ 文件部分处理成功。\n\n${processingResult.warnings?.join('\n') || ''}`);
          }, 100);
        } else if (processingResult.status === 'failed') {
          setTimeout(() => {
            alert(`❌ 文件处理失败。\n\n${processingResult.errors?.join('\n') || ''}`);
          }, 100);
        }
        
        // 如果是因为提供商不支持，给出建议
        if (!supportAnalysis.supported) {
          setTimeout(() => {
            alert(`${recommendation}\n\n文件已进行本地文本提取，但可能无法获得最佳效果。`);
          }, 100);
        }
      }
    } catch (error) {
      console.error('💥 Error processing file:', error);
      alert('文件处理失败，请重试。如果问题持续存在，请检查文件格式和大小。');
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const newFiles = prev.filter(f => f.id !== fileId);
      // If removing an image, also clear uploadedImage if it matches
      const removedFile = prev.find(f => f.id === fileId);
      if (removedFile && removedFile.type.startsWith('image/') && removedFile.url === uploadedImage) {
        setUploadedImage(null);
      }
      return newFiles;
    });
  };

  // Add regenerate message functionality
  const regenerateMessage = async (messageId: string, newModel?: string) => {
    if (!currentSessionId || !currentSession) {
      console.error("No current session to regenerate message in.");
      return;
    }

    setIsLoading(true);

    // Find the message to regenerate and its index
    const messageIndex = currentSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      console.error("Message not found for regeneration");
      setIsLoading(false);
      return;
    }

    // Get all messages up to and including the user message that prompted this response
    let contextMessages = [];
    let userMessageFound = false;
    
    // Work backwards to find the user message that prompted this response
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (currentSession.messages[i].role === 'user') {
        userMessageFound = true;
        contextMessages.unshift(currentSession.messages[i]); // Add the user message
        break;
      }
    }

    if (!userMessageFound) {
      console.error("Could not find preceding user message for regeneration");
      setIsLoading(false);
      return;
    }

    // Add all earlier conversation history for context
    const historyMessages = currentSession.messages.slice(0, messageIndex - 1);
    contextMessages = [...historyMessages, ...contextMessages];

    // Mark the current message as thinking
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === currentSessionId
          ? {
              ...s,
              messages: s.messages.map((m, i) =>
                i === messageIndex
                  ? { ...m, content: '', thinking: '', isThinking: true }
                  : m
              )
            }
          : s
      )
    );

    // Get the latest user message for regeneration
    const userMessage = contextMessages[contextMessages.length - 1];

    // Determine which model to use
    const modelToUse = newModel || currentSession.model || model;

    // Set up the request
    abortControllerRef.current = new AbortController();
    let accumulatedResponse = '';
    let reasoningBuffer = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(
          addApiKeyToRequest({
            model: modelToUse,
            messages: contextMessages.map(m => ({ role: m.role, content: m.content })),
            stream: true,
            ...advancedSettings,
          } as LLMRequest)
        ),
      });

      if (!response.ok || !response.body) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // 添加浏览器兼容性检查
      if (!response.body.getReader) {
        throw new Error('ReadableStream not supported in this environment');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = ''; // Buffer for SSE messages
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Final update when stream is done
          updateAssistantMessage(
            currentSessionId,
            messageId,
            accumulatedResponse,
            reasoningBuffer,
            false
          );
          
          setIsLoading(false);
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        sseBuffer += chunkText; // Append to buffer
        
        // Process complete SSE events
        let delimiterIndex;
        while ((delimiterIndex = sseBuffer.indexOf('\n\n')) !== -1) {
          const eventText = sseBuffer.slice(0, delimiterIndex);
          sseBuffer = sseBuffer.slice(delimiterIndex + 2); // Keep the rest
          
          if (!eventText.startsWith('data: ')) continue;
          const jsonData = eventText.substring(6).trim();
          
          if (jsonData === '[DONE]' || jsonData.includes('"type":"done_event"')) {
            updateAssistantMessage(
              currentSessionId,
              messageId,
              accumulatedResponse,
              reasoningBuffer,
              false
            );
            
            setIsLoading(false);
            return;
          }
          
          try {
            const parsedSSE = JSON.parse(jsonData);
            
            // Handle direct thinking data from Gemini (new format)
            if (parsedSSE.thinking) {
              // Gemini思考内容直接处理
              reasoningBuffer += `${parsedSSE.thinking}\n`;
              updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.content) {
              // Regular content to display in the message
              accumulatedResponse += parsedSSE.content;
              
              // Update the message with new content, preserve thinking state
              updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.reasoning_content) {
              // Add reasoning content to the reasoning buffer
              reasoningBuffer += parsedSSE.reasoning_content + "\n";
              
              // Update the message with new thinking content but keep isThinking true
              updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
            } else if (parsedSSE.error) {
              console.error("SSE Error Chunk:", parsedSSE.error, parsedSSE.details);
              accumulatedResponse += `\n\n[Error: ${parsedSSE.error}]`;
              
              updateAssistantMessage(
                currentSessionId,
                messageId,
                accumulatedResponse,
                reasoningBuffer + `Error: ${parsedSSE.error}\n`,
                false
              );
              
              setIsLoading(false);
              return;
            } else if (parsedSSE.finish_reason) {
              // When we get a finish reason, mark thinking as complete
              updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, false);
              setIsLoading(false);
            } else {
              // Legacy format handling with {type, data}
              const { type: stepType, data: eventData } = parsedSSE;
              
              if (eventData && eventData.error) {
                console.error("SSE Error Chunk:", eventData.error, eventData.details);
                accumulatedResponse += `\n\n[Error: ${eventData.error}]`;
                
                updateAssistantMessage(
                  currentSessionId,
                  messageId,
                  accumulatedResponse,
                  reasoningBuffer + `Error: ${eventData.error}\n`,
                  false
                );
                
                setIsLoading(false);
                return;
              }

              // Process different types of chunks
              if (stepType === 'thinking_step' && eventData.thinking) {
                // Gemini的思考内容（使用thinking字段）
                reasoningBuffer += `${eventData.thinking}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'thinking_step' && eventData.content) {
                // Add to reasoning buffer when we get thinking steps
                reasoningBuffer += `${eventData.content}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'thinking_step' && eventData.reasoning_content) {
                // Add to reasoning buffer when we get reasoning content
                reasoningBuffer += `${eventData.reasoning_content}\n`;
                
                // Update the message with new thinking content but keep isThinking true
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'step' && eventData.content) {
                reasoningBuffer += `Step: ${eventData.content}\n`;
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'tool_use_step' && eventData) {
                let toolInfo = 'Tool Invocation:\n';
                if(eventData.tool_name) toolInfo += `  Name: ${eventData.tool_name}\n`;
                if(eventData.tool_id) toolInfo += `  ID: ${eventData.tool_id}\n`;
                if(eventData.tool_input) toolInfo += `  Input: ${JSON.stringify(eventData.tool_input, null, 2)}\n`;
                if(eventData.tool_arguments) toolInfo += `  Arguments: ${JSON.stringify(eventData.tool_arguments, null, 2)}\n`;
                if(eventData.tool_arguments_raw) toolInfo += `  Arguments (raw): ${eventData.tool_arguments_raw}\n`;
                
                reasoningBuffer += toolInfo;
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'content_chunk' && eventData.content) {
                accumulatedResponse += eventData.content;
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              }
            }
          } catch (e) {
            console.error('Error parsing SSE JSON data:', jsonData, e);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted by user.');
        updateAssistantMessage(
          currentSessionId,
          messageId,
          "[Cancelled by user]",
          reasoningBuffer + "\nRequest Cancelled by User.\n",
          false
        );
      } else {
        console.error('Error regenerating message:', error);
        const errorMessage = `Error: ${error.message || 'Failed to get response.'}`;
        updateAssistantMessage(
          currentSessionId,
          messageId,
          errorMessage,
          reasoningBuffer + errorMessage + `\n`,
          false
        );
      }
      setIsLoading(false);
    }

    // Update the session model if we switched models for this message
    if (newModel && newModel !== currentSession.model) {
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === currentSessionId
            ? { ...s, model: newModel }
            : s
        )
      );
      setModel(newModel);
    }
  };

  if (!currentSession) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading session...</div>; 
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar */}
      <Sidebar 
        sessions={sessions} 
        currentSessionId={currentSessionId} 
        onNewSession={handleNewSession} 
        onSwitchSession={handleSwitchSession}
        onArchiveSession={handleArchiveSession}
        onDeleteSession={handleDeleteSession}
        onBatchDeleteSessions={handleBatchDeleteSessions}
        isOpen={isSidebarOpen}
      />
      
      {/* 小屏幕背景遮罩 */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main Content Area - 响应式侧边栏适配 */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
        isSidebarOpen ? 'lg:ml-80' : 'ml-0'
      }`}>
        {/* Top Bar */}
        <TopBar 
          currentSessionName={currentSession?.name}
          onNewSession={handleNewSession}
          onArchiveSession={currentSession && !currentSession.archived ? () => handleArchiveSession(currentSession.id) : undefined}
          onDeleteSession={currentSession ? () => handleDeleteSession(currentSession.id) : undefined}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
        
        {/* Content Container - 优化横向布局和自适应设计 */}
        <div className="flex flex-col flex-1 items-center w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6">
          <div className="w-full max-w-3xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
            {/* Model Selector and Settings */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-slate-700/50 p-4 sm:p-6 mb-4 sm:mb-6 shadow-xl">
              <div className="flex flex-col gap-3 sm:gap-4">
                <ModelSelector 
                  value={model}
                  onChange={(newModel) => { 
                    setModel(newModel); 
                    if(currentSessionId) {
                      setSessions(prev => prev.map(s => s.id === currentSessionId ? {...s, model: newModel} : s));
                    }
                  }}
                  disabledProviders={disabledProviders}
                />
                
                {/* Advanced Settings */}
                <AdvancedSettings
                  selectedModel={model}
                  settings={advancedSettings}
                  onChange={setAdvancedSettings}
                  onReset={() => setAdvancedSettings({})}
                />
              </div>
            </div>

            {/* Message List Area - 自适应高度和宽度 */}
            <div className={`flex flex-col flex-1 bg-slate-900/30 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden mb-4 sm:mb-6 ${
              currentSession?.messages.length === 0 
                ? 'min-h-[50vh] sm:min-h-[55vh] lg:min-h-[60vh]' 
                : 'min-h-[45vh] sm:min-h-[50vh] lg:min-h-[55vh] max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh]'
            }`}>
              {currentSession?.messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 sm:p-8">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12s3.86-8.25 8.625-8.25S21 7.444 21 12z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-200 mb-2 text-center">How can I help you today?</h2>
                  <p className="text-sm sm:text-base text-slate-400 text-center">Start a conversation with your AI assistant</p>
                </div>
              )}
              {currentSession && (
                <MessageList 
                  messages={currentSession.messages} 
                  onRegenerate={regenerateMessage}
                  currentModel={model}
                />
              )}
            </div>

            {/* Chat Input Area */}
            <ChatInput 
              value={input} 
              onChange={setInput} 
              onSend={handleSend} 
              onImageUpload={handleImageUpload}
              onFileUpload={handleFileUpload}
              disabled={isLoading} 
              onCancel={handleCancel} 
              showCancel={isLoading}
              currentModel={model}
              uploadedFiles={uploadedFiles}
              onRemoveFile={handleRemoveFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

