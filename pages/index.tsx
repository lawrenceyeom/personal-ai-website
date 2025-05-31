// pages/index.tsx
// 主页：AI多模型对话主界面，包含模型切换、历史会话管理、流式对话、消息渲染等核心功能。
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MessageList from '../components/MessageList';
import ChatInput, { UploadedFile } from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import AdvancedSettings from '../components/AdvancedSettings';
import { LLMRequest, getModelMapping } from '../utils/llm';
import { Message, ChatSession } from '../interfaces';

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
        
        // 🔧 智能清理策略 - 按优先级顺序执行
        try {
          // 策略1: 首先删除已归档的会话
          const archivedSessions = sessions.filter(s => s.archived);
          if (archivedSessions.length > 0) {
            const cleanedSessions = sessions.filter(s => !s.archived);
            localStorage.setItem('chat_sessions', JSON.stringify(cleanedSessions));
            console.log(`✅ 清理策略1: 删除了 ${archivedSessions.length} 个归档会话`);
            return;
          }
          
          // 策略2: 如果会话数量过多（>20），保留最近的20个会话
          if (sessions.length > 20) {
            const sortedSessions = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
            const recentSessions = sortedSessions.slice(0, 20);
            localStorage.setItem('chat_sessions', JSON.stringify(recentSessions));
            console.log(`✅ 清理策略2: 保留最近的20个会话，删除了 ${sessions.length - recentSessions.length} 个旧会话`);
            return;
          }
          
          // 策略3: 清理每个会话中的长消息内容（只保留前800字符）
          const compactSessions = sessions.map(session => ({
            ...session,
            messages: session.messages.map(msg => ({
              ...msg,
              content: typeof msg.content === 'string' && msg.content.length > 800 
                ? msg.content.substring(0, 800) + '...[自动截断以节省空间]'
                : msg.content,
              thinking: msg.thinking && msg.thinking.length > 400 
                ? msg.thinking.substring(0, 400) + '...[思考过程已截断]'
                : msg.thinking,
              // 🔧 清理搜索结果数据以节省空间
              searchResults: msg.searchResults ? {
                ...msg.searchResults,
                results: msg.searchResults.results?.slice(0, 3) || [], // 只保留前3个搜索结果
                summary: msg.searchResults.summary && msg.searchResults.summary.length > 300
                  ? msg.searchResults.summary.substring(0, 300) + '...[摘要已截断]'
                  : msg.searchResults.summary
              } : undefined
            }))
          }));
          
          localStorage.setItem('chat_sessions', JSON.stringify(compactSessions));
          console.log('✅ 清理策略3: 压缩消息内容，截断长文本和搜索结果');
          
          // 🔧 显示用户友好的提示
          setTimeout(() => {
            alert(
              '📦 存储空间优化完成\n\n' +
              '由于存储空间限制，系统已自动：\n' +
              '• 压缩了长消息内容\n' +
              '• 精简了搜索结果数据\n' +
              '• 保留了会话的核心信息\n\n' +
              '建议定期清理不需要的会话以获得更好的性能。'
            );
          }, 500);
          
        } catch (retryError) {
          console.error('Failed to clean up localStorage:', retryError);
          
          // 🔧 最终备用方案：渐进式清理
          try {
            // 尝试删除最旧的一半会话
            const sortedSessions = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
            const halfSessions = sortedSessions.slice(0, Math.ceil(sessions.length / 2));
            localStorage.setItem('chat_sessions', JSON.stringify(halfSessions));
            
            console.log(`⚠️ 备用清理: 保留了最近的 ${halfSessions.length} 个会话`);
            alert(
              '⚠️ 存储空间严重不足\n\n' +
              `已删除较旧的 ${sessions.length - halfSessions.length} 个会话，\n` +
              `保留了最近的 ${halfSessions.length} 个会话。\n\n` +
              '请考虑定期备份重要的对话内容。'
            );
            
          } catch (finalError) {
            console.error('Final cleanup attempt failed:', finalError);
            // 最后的手段：清空所有会话数据
            localStorage.removeItem('chat_sessions');
            alert(
              '🚨 存储空间清理失败\n\n' +
              '由于存储限制，已清空所有历史会话。\n' +
              '请刷新页面重新开始，并考虑：\n' +
              '• 定期导出重要对话\n' +
              '• 及时清理不需要的会话\n' +
              '• 避免保存过长的对话内容'
            );
          }
        }
      } else {
        console.error('Error saving sessions:', error);
        // 🔧 其他类型的存储错误处理
        if (error.message.includes('security') || error.message.includes('private')) {
          console.warn('存储被阻止，可能是隐私模式或安全设置');
        }
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
  
  // 添加状态跟踪内存警告，避免死循环
  const [hasShownMemoryWarning, setHasShownMemoryWarning] = useState(false);
  
  // Ref for the abort controller to cancel API requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // 添加搜索相关状态
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);

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

        // 🔧 优化localStorage使用情况检测
        try {
          // 🔧 增加防重复时间间隔为30分钟，减少频繁检测
          const lastWarningTime = localStorage.getItem('last_memory_warning');
          const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000); // 30分钟
          
          if (lastWarningTime && parseInt(lastWarningTime) > thirtyMinutesAgo) {
            console.log('⏰ 内存警告已在最近30分钟内显示过，跳过检测');
            return;
          }
          
          const sessionsData = localStorage.getItem('chat_sessions');
          if (sessionsData) {
            const sizeInBytes = new Blob([sessionsData]).size;
            const sizeInMB = sizeInBytes / (1024 * 1024);
            
            // 🔧 智能估算localStorage配额（更准确的估算，针对多媒体内容优化）
            let estimatedQuotaMB = 20; // 🔧 提高默认值到20MB，适应多媒体文件存储
            
            // 根据浏览器类型进行更精确的配额估算
            try {
              if (navigator.storage && navigator.storage.estimate) {
                // 对于支持Storage API的现代浏览器，使用实际配额
                navigator.storage.estimate().then(estimate => {
                  if (estimate.quota) {
                    const actualQuotaMB = estimate.quota / (1024 * 1024);
                    // 🔧 localStorage通常是总配额的约10%，但至少20MB用于多媒体存储
                    const localStorageQuota = Math.max(actualQuotaMB * 0.1, 20);
                    estimatedQuotaMB = Math.min(localStorageQuota, 100); // 最大100MB
                    console.log(`📊 Storage API检测: 总配额${actualQuotaMB.toFixed(2)}MB, LocalStorage估算${estimatedQuotaMB.toFixed(2)}MB`);
                  }
                });
              } else {
                // 对于不支持的浏览器，基于用户代理字符串估算（针对多媒体优化）
                const userAgent = navigator.userAgent.toLowerCase();
                if (userAgent.includes('chrome') || userAgent.includes('edge')) {
                  estimatedQuotaMB = 50; // 🔧 Chrome/Edge提高到50MB，支持更多图片文件
                } else if (userAgent.includes('firefox')) {
                  estimatedQuotaMB = 40; // 🔧 Firefox提高到40MB
                } else if (userAgent.includes('safari')) {
                  estimatedQuotaMB = 25; // 🔧 Safari提高到25MB，仍然相对保守
                } else if (userAgent.includes('opera')) {
                  estimatedQuotaMB = 35; // 🔧 Opera提高到35MB
                } else {
                  estimatedQuotaMB = 20; // 🔧 其他浏览器默认20MB
                }
              }
            } catch (quotaError) {
              console.warn('无法获取准确的存储配额，使用默认值:', quotaError);
            }
            
            const usagePercentage = (sizeInMB / estimatedQuotaMB) * 100;
            
            console.log(`📊 LocalStorage usage: ${sizeInMB.toFixed(2)}MB / ${estimatedQuotaMB}MB (${usagePercentage.toFixed(1)}%)`);
            
            // 🔧 提高警告阈值：90%时控制台警告，95%时用户提示
            if (usagePercentage > 90) {
              console.warn('⚠️ LocalStorage usage high, consider clearing old sessions');
              
              // 🔧 当使用超过95%时显示用户提示（提高阈值减少频繁弹窗）
              if (usagePercentage > 95 && !hasShownMemoryWarning) {
                setHasShownMemoryWarning(true);
                
                setTimeout(() => {
                  const shouldClean = confirm(
                    `⚠️ 存储空间警告 ⚠️\n\n` +
                    `当前使用率: ${usagePercentage.toFixed(1)}% (${sizeInMB.toFixed(2)}MB / ${estimatedQuotaMB}MB)\n\n` +
                    `存储空间即将用完，为避免数据丢失，建议清理一些旧的会话记录。\n\n` +
                    `点击"确定"清理已归档的会话，或"取消"手动管理。`
                  );
                  
                  if (shouldClean) {
                    // 记录警告时间，防止重新加载后再次显示
                    localStorage.setItem('last_memory_warning', Date.now().toString());
                    
                    const currentSessions = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
                    const cleanedSessions = currentSessions.filter((s: ChatSession) => !s.archived);
                    
                    // 🔧 如果没有归档会话，提供额外的清理选项
                    if (cleanedSessions.length === currentSessions.length) {
                      const shouldCleanOld = confirm(
                        '没有找到归档会话可清理。\n\n' +
                        '是否删除最旧的一半会话以释放空间？\n\n' +
                        '（将保留最近的会话记录）'
                      );
                      
                      if (shouldCleanOld) {
                        const sortedSessions = [...currentSessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
                        const keepCount = Math.ceil(sortedSessions.length / 2);
                        const keptSessions = sortedSessions.slice(0, keepCount);
                        localStorage.setItem('chat_sessions', JSON.stringify(keptSessions));
                        
                        const deletedCount = currentSessions.length - keptSessions.length;
                        alert(`✅ 已删除 ${deletedCount} 个旧会话，保留了 ${keptSessions.length} 个最近会话。`);
                        location.reload();
                        return;
                      }
                    } else {
                      localStorage.setItem('chat_sessions', JSON.stringify(cleanedSessions));
                      
                      // 显示清理结果并刷新页面
                      const cleanedCount = currentSessions.length - cleanedSessions.length;
                      alert(`✅ 已清理 ${cleanedCount} 个归档会话，释放存储空间。`);
                      location.reload();
                      return;
                    }
                  }
                  
                  // 用户点击取消，记录警告时间避免频繁弹窗
                  localStorage.setItem('last_memory_warning', Date.now().toString());
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
  }, [hasShownMemoryWarning]);

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
    const updatedReq = { ...req };
    if (apiKey) {
      updatedReq.apiKey = apiKey;
    }
    
    // 添加网络设置选项
    const networkOptions = getNetworkOptions();
    updatedReq.api_options = networkOptions;
    
    return updatedReq;
  };

  // 辅助函数：构建消息内容
  const buildMessageContent = async (
    userInput: string, 
    files: UploadedFile[], 
    image: string | null, 
    currentModel: string
  ) => {
    let displayContent = userInput;
    let apiContent: string | any = userInput;
    let additionalInfo = '';

    const modelInfo = MODEL_MAPPING[currentModel];
    
    if (files.length > 0) {
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const textFiles = files.filter(f => f.content && !f.fileId && !f.fileUri);
      const nativeDocFiles = files.filter(f => f.fileId || f.fileUri);
      const otherFiles = files.filter(f => !f.type.startsWith('image/') && !f.content && !f.fileId && !f.fileUri);
      
      // 处理文本文件
      if (textFiles.length > 0) {
        additionalInfo += '\n\n--- 上传的文件内容 ---\n';
        textFiles.forEach(file => {
          additionalInfo += `\n[文件: ${file.name}]\n${file.content}\n`;
        });
      }
      
      // 处理原生文档文件
      if (nativeDocFiles.length > 0) {
        if (modelInfo?.supports?.documents) {
          if (modelInfo.provider === 'google' || modelInfo.provider === 'gemini') {
            const fileDataParts = nativeDocFiles.filter(f => f.fileUri).map(file => ({
              file_data: { mime_type: file.type || 'application/pdf', file_uri: file.fileUri }
            }));
            if (fileDataParts.length > 0) {
              apiContent = [{ type: 'text', text: userInput }, ...fileDataParts];
              console.log('📄 Gemini文档引用构建成功:', fileDataParts.length);
            }
          } else if (modelInfo.provider === 'openai') {
            const fileDataParts = nativeDocFiles.filter(f => f.fileId).map(file => ({
              type: 'file', file: { file_id: file.fileId }
            }));
            if (fileDataParts.length > 0) {
              apiContent = [{ type: 'text', text: userInput }, ...fileDataParts];
              console.log('📄 OpenAI文档引用构建成功:', fileDataParts.length);
            }
          }
          
          // 添加文档信息到显示内容
          additionalInfo += '\n\n--- 已上传文档 ---\n';
          nativeDocFiles.forEach(file => {
            if (file.fileId) additionalInfo += `[${modelInfo.provider}文件: ${file.name}, ID: ${file.fileId}]\n`;
            else if (file.fileUri) additionalInfo += `[${modelInfo.provider}文件: ${file.name}, URI: ${file.fileUri}]\n`;
          });
        } else {
          additionalInfo += '\n\n--- 文档上传警告 ---\n';
          nativeDocFiles.forEach(file => {
            additionalInfo += `[警告: ${file.name} 已上传但当前模型不支持原生文档处理]\n`;
          });
        }
      }
      
      // 处理其他文件
      if (otherFiles.length > 0) {
        additionalInfo += '\n\n--- 其他上传文件 ---\n';
        otherFiles.forEach(file => {
          additionalInfo += `[文件: ${file.name}, 类型: ${file.type}, 大小: ${(file.size / 1024).toFixed(2)}KB]\n`;
        });
      }
      
      // 处理图片文件
      if (imageFiles.length > 0) {
        if (modelInfo?.supports?.vision) {
          const textContent = typeof apiContent === 'string' ? apiContent : userInput;
          const contentParts: any[] = [{ type: 'text', text: textContent }];
          imageFiles.forEach(file => {
            if (file.url) contentParts.push({ type: 'image_url', image_url: { url: file.url } });
          });
          apiContent = contentParts;
          console.log('🖼️ 多模态图片内容构建成功:', imageFiles.length);
        } else {
          additionalInfo += '\n\n[注意：当前模型不支持图像理解，已上传图片但无法分析]';
        }
      }
    } else if (image) {
      // 向后兼容旧的uploadedImage逻辑
      if (modelInfo?.supports?.vision) {
        apiContent = [{ type: 'text', text: userInput }, { type: 'image_url', image_url: { url: image } }];
        console.log('🖼️ 单图片内容构建成功');
      } else {
        additionalInfo += '\n\n[注意：当前模型不支持图像理解，图片已上传但无法分析]';
      }
    }

    // 合并额外信息到显示内容
    if (additionalInfo) {
      displayContent = userInput + additionalInfo;
    }

    // 如果API内容仍然是字符串且有额外信息，合并到API内容
    if (typeof apiContent === 'string' && additionalInfo) {
      apiContent = userInput + additionalInfo;
    }

    return {
      displayContent,
      apiContent,
      additionalInfo
    };
  };

  // ================== 增强的搜索执行函数 ==================
  const executeSearch = async (
    query: string, 
    sessionId: string,
    files: UploadedFile[] = [],
    imageUrl: string | null = null
  ) => {
    // 创建搜索状态消息
    const searchMessageId = `search-${Date.now()}`;
    
    try {
      console.log('🔍 搜索功能已启用，开始搜索...', {
        query: query.substring(0, 100),
        hasFiles: files.length > 0,
        hasImage: !!imageUrl,
        multimodal: files.length > 0 || !!imageUrl
      });
      
      // 根据是否有多模态内容调整搜索状态消息
      const searchStatusText = files.length > 0 || imageUrl 
        ? '🔍 正在基于内容搜索相关信息...' 
        : '🔍 正在搜索相关信息...';
      
      const searchMessage: Message = {
        id: searchMessageId,
        role: 'search',
        content: searchStatusText,
        isSearching: true,
        searchQuery: query.trim()
      };
      addMessageToCurrentSession(searchMessage);
      
      // 获取Gemini API密钥用于搜索
      const geminiApiKey = getApiKeyForProvider('google') || getApiKeyForProvider('gemini');
      
      if (!geminiApiKey) {
        console.warn('⚠️ 未配置Gemini API密钥，跳过搜索');
        updateSearchMessage(sessionId, searchMessageId, '⚠️ 搜索失败：未配置Gemini API密钥', {
          success: false,
          query: query.trim(),
          results: [],
          error: '未配置Gemini API密钥'
        });
        return { data: null };
      }

      // 构建多模态搜索内容
      const searchContent = await buildMultimodalSearchContent(query, files, imageUrl);

      // 执行搜索 - 支持多模态
      const searchResponse = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          multimodalContent: searchContent,
          config: {
            apiKey: geminiApiKey,
            maxResults: 8,
            language: 'zh-CN'
          }
        })
      });

      if (searchResponse.ok) {
        const searchResultsData = await searchResponse.json();
        console.log('✅ 搜索完成:', searchResultsData);

        updateSearchMessage(sessionId, searchMessageId, '✅ 搜索完成', searchResultsData);
        return { data: searchResultsData };
      } else {
        console.error('❌ 搜索失败:', await searchResponse.text());
        updateSearchMessage(sessionId, searchMessageId, '❌ 搜索失败', {
          success: false,
          query: query.trim(),
          results: [],
          error: '搜索服务暂时不可用'
        });
        return { data: null };
      }
    } catch (searchError) {
      console.error('❌ 搜索过程发生错误:', searchError);
      updateSearchMessage(sessionId, searchMessageId, '❌ 搜索出错', {
        success: false,
        query: query.trim(),
        results: [],
        error: searchError instanceof Error ? searchError.message : '未知错误'
      });
      return { data: null };
    }
  };

  // ================== 多模态搜索内容构建器 ==================
  const buildMultimodalSearchContent = async (
    query: string,
    files: UploadedFile[],
    imageUrl: string | null
  ): Promise<any> => {
    try {
      console.log('🔗 构建多模态搜索内容:', {
        hasQuery: !!query,
        filesCount: files.length,
        hasImage: !!imageUrl
      });

      // 如果没有多模态内容，返回简单文本
      if (files.length === 0 && !imageUrl) {
        return { text: query };
      }

      // 构建Gemini格式的多模态内容
      const parts = [];

      // 添加文本查询
      if (query.trim()) {
        parts.push({
          text: `用户查询: ${query}\n\n请基于以下提供的图片和文档内容，搜索相关信息并提供准确答案：`
        });
      }

      // 处理图片
      if (imageUrl) {
        console.log('🖼️ 添加图片到搜索内容');
        // 获取图片的base64数据
        const base64Data = imageUrl.split(',')[1];
        const mimeType = imageUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }

      // 处理文件
      for (const file of files) {
        console.log(`📄 添加文件到搜索内容: ${file.name}`);
        
        if (file.fileUri) {
          // Gemini原生文档
          parts.push({
            file_data: {
              mime_type: file.type,
              file_uri: file.fileUri
            }
          });
        } else if (file.content && !file.content.startsWith('🔄') && !file.content.startsWith('❌')) {
          // 文本内容
          parts.push({
            text: `文件内容 (${file.name}):\n${file.content.substring(0, 8000)}\n\n`
          });
        }
      }

      console.log('✅ 多模态内容构建完成:', {
        partsCount: parts.length,
        hasTextParts: parts.some(p => p.text),
        hasImageParts: parts.some(p => p.inlineData),
        hasFileParts: parts.some(p => p.file_data)
      });

      return { parts };

    } catch (error) {
      console.error('❌ 构建多模态搜索内容失败:', error);
      // 回退到简单文本
      return { text: query };
    }
  };

  // 辅助函数：更新搜索消息
  const updateSearchMessage = (sessionId: string, messageId: string, content: string, searchResults: any) => {
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === messageId
                  ? { 
                      ...m, 
                      content,
                      isSearching: false,
                      searchResults
                    }
                  : m
              ),
              lastUpdated: Date.now()
            }
          : s
      )
    );
  };

  // 辅助函数：合并搜索结果
  const mergeSearchResults = async (apiContent: any, searchData: any) => {
    try {
      const { enhanceMessageWithSearch } = await import('../utils/llm/search');
      
      if (typeof apiContent === 'string') {
        // 字符串内容直接合并
        return enhanceMessageWithSearch(apiContent, searchData);
      } else if (Array.isArray(apiContent)) {
        // 复杂内容（包含文件引用），更新文本部分
        const updatedContent = [...apiContent];
        const textPartIndex = updatedContent.findIndex(part => part.type === 'text');
        
        if (textPartIndex !== -1) {
          const originalText = updatedContent[textPartIndex].text;
          updatedContent[textPartIndex].text = enhanceMessageWithSearch(originalText, searchData);
          console.log('🔗 搜索结果已合并到多模态内容');
          return updatedContent;
        }
      }
      
      console.log('⚠️ 无法合并搜索结果，使用原始内容');
      return apiContent;
    } catch (error) {
      console.error('❌ 合并搜索结果失败:', error);
      return apiContent;
    }
  };

  // 主要的handleSend函数
  const handleSend = async () => {
    if (!input.trim() && !uploadedImage && uploadedFiles.length === 0) return;
    if (!currentSessionId || !currentSession) {
      console.error("No current session to send message to.");
      return;
    }

    setIsLoading(true);
    
    // ================== 步骤1: 构建文件和图片内容 ==================
    const originalUserInput = input;
    let displayContent = originalUserInput;
    let apiMessageContent: string | any = originalUserInput;

    // 处理上传的文件和图片
    if (uploadedFiles.length > 0 || uploadedImage) {
      const result = await buildMessageContent(originalUserInput, uploadedFiles, uploadedImage, model);
      apiMessageContent = result.apiContent;
      displayContent = result.displayContent;
    }

    // ================== 步骤2: 显示用户消息 ==================
    const userMessageForSession: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: displayContent,
      ...(uploadedFiles.length > 0 && { files: uploadedFiles }),
      ...(uploadedImage && { imageUrl: uploadedImage })
    };
    
    addMessageToCurrentSession(userMessageForSession);
    setInput('');
    setUploadedImage(null);
    setUploadedFiles([]);

    // ================== 步骤3: 处理搜索功能 ==================
    let finalApiContent = apiMessageContent;

    if (isSearchEnabled && originalUserInput.trim()) {
      const searchResult = await executeSearch(originalUserInput, currentSessionId, uploadedFiles, uploadedImage);
      
      // 如果搜索成功，合并搜索结果到API内容
      if (searchResult.data?.success && searchResult.data.summary) {
        finalApiContent = await mergeSearchResults(apiMessageContent, searchResult.data);
      }
    }

    // ================== 步骤4: 创建AI响应并发送 ==================
    // 创建助理消息占位符
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      thinking: '', 
      isThinking: true, 
    };
    addMessageToCurrentSession(assistantMessagePlaceholder);

    abortControllerRef.current = new AbortController();
    let accumulatedResponse = '';
    let reasoningBuffer = '';

    try {
      // 构建发送到API的最终消息数组
      const apiMessages = currentSession.messages
        .filter((m: Message) => m.role !== 'search') // 过滤掉搜索消息，不发送给AI
        .map((m: Message) => ({ role: m.role, content: m.content }));
      
      // 为API调用添加当前用户消息
      apiMessages.push({ role: 'user', content: finalApiContent });
      
      console.log('🔍 最终发送的消息数组:', {
        messagesCount: apiMessages.length,
        lastMessageType: typeof finalApiContent,
        model: model,
        hasFiles: uploadedFiles.length > 0,
        hasSearch: isSearchEnabled
      });
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(
          addApiKeyToRequest({
            model: currentSession.model || model,
            messages: apiMessages,
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

    // 重新构建包含文件引用的用户消息内容（如果原消息包含文件）
    let regenerateMessageContent = userMessage.content;
    if (userMessage.files && userMessage.files.length > 0) {
      // 重新构建复杂的消息内容以包含文件引用
      const files = userMessage.files;
      const nativeDocFiles = files.filter(f => f.fileId || f.fileUri);
      
      if (nativeDocFiles.length > 0) {
        const modelInfo = MODEL_MAPPING[model];
        if (modelInfo?.supports?.documents) {
          if (modelInfo.provider === 'google' || modelInfo.provider === 'gemini') {
            const fileDataParts = nativeDocFiles.filter(f => f.fileUri).map(file => ({
              file_data: { mime_type: file.type || 'application/pdf', file_uri: file.fileUri }
            }));
            if (fileDataParts.length > 0) {
              // 从显示内容中提取原始文本（去除文件信息）
              const textContent = userMessage.content.split('\n\n--- ')[0] || userMessage.content;
              regenerateMessageContent = [{ type: 'text', text: textContent }, ...fileDataParts];
              console.log('🔄 Regenerate: Gemini文件引用重建成功:', { partsCount: fileDataParts.length });
            }
          } else if (modelInfo.provider === 'openai') {
            const fileDataParts = nativeDocFiles.filter(f => f.fileId).map(file => ({
              type: 'file', file: { file_id: file.fileId }
            }));
            if (fileDataParts.length > 0) {
              // 从显示内容中提取原始文本（去除文件信息）
              const textContent = userMessage.content.split('\n\n--- ')[0] || userMessage.content;
              regenerateMessageContent = [{ type: 'text', text: textContent }, ...fileDataParts];
              console.log('🔄 Regenerate: OpenAI文件引用重建成功:', { partsCount: fileDataParts.length });
            }
          }
        }
      }
    }

    // Determine which model to use
    const modelToUse = newModel || currentSession.model || model;

    // Set up the request
    abortControllerRef.current = new AbortController();
    let accumulatedResponse = '';
    let reasoningBuffer = '';

    try {
      // 构建API消息，确保最后一条用户消息使用正确的内容格式
      const apiContextMessages = contextMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      apiContextMessages.push({ role: 'user', content: regenerateMessageContent });
      
      console.log('🔄 Regenerate: 发送的消息数组:', apiContextMessages);
      console.log('🔄 Regenerate: 用户消息内容:', regenerateMessageContent);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify(
          addApiKeyToRequest({
            model: modelToUse,
            messages: apiContextMessages,
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
              onSearchToggle={setIsSearchEnabled}
              isSearchEnabled={isSearchEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

