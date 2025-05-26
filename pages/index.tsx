// pages/index.tsx
// 主页：AI多模型对话主界面，包含模型切换、历史会话管理、流式对话、消息渲染等核心功能。
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import PromptCards from '../components/PromptCards';
import MessageList from '../components/MessageList';
import ChatInput, { UploadedFile } from '../components/ChatInput';
import ModelSelector from '../components/ModelSelector';
import AdvancedSettings from '../components/AdvancedSettings';
import { LLMRequest } from '../utils/llmProviders';
import { MODEL_MAPPING } from '../utils/llmProviders';
import { Message, ChatSession } from '../interfaces';

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
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }
}

const DEFAULT_MODEL = 'deepseek-v3';

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
  
  // Only Claude is potentially disabled if no key is found in localStorage.
  // DeepSeek has a default key. Gemini and GPT have test keys as fallbacks in llmProviders.ts.
  const [disabledProviders, setDisabledProviders] = useState<string[]>([]);
  
  // Ref for the abort controller to cancel API requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for available API keys to update UI for Claude
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
        const newDisabled: string[] = [];
        
        // Claude is disabled in UI if no key is in localStorage (it has no test/default key)
        if (!savedKeys['claude']) {
          newDisabled.push('claude');
        }
        setDisabledProviders(newDisabled);
      } catch (error) {
        console.error('Error reading API keys from localStorage for UI disable state:', error);
        // If localStorage is corrupted, assume Claude is disabled for the UI.
        setDisabledProviders(['claude']);
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

  // Automatically summarize the conversation title
  const summarizeTitle = async (sessionId: string, messages: Message[]) => {
    if (messages.length < 2 || messages.length > 10) return; // Only summarize for reasonable length convos
    const conversationText = messages.slice(0, 5).map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Summarize the following conversation into a short title (max 5 words):\n\n${conversationText}`;
    
    // Get network options to pass to the API
    const currentNetworkOptions = getNetworkOptions();
    console.log('Using title summarization with options:', currentNetworkOptions);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3', // Use DeepSeek for fast and reliable title generation
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3, // Lower temperature for more consistent titles
          max_tokens: 50, // Short titles
          api_options: currentNetworkOptions
        }),
      });
      
      if (!response.ok) {
        console.error('Title summarization failed with status:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('Title summarization response:', data);
      
      if (data.title && typeof data.title === 'string') {
        setSessions(prevSessions =>
          prevSessions.map(s => (s.id === sessionId ? { ...s, name: data.title.trim() } : s))
        );
      } else if (data.content && typeof data.content === 'string') {
        // Use content field if title isn't available
        const title = data.content.trim().substring(0, 30); // Limit length
        setSessions(prevSessions =>
          prevSessions.map(s => (s.id === sessionId ? { ...s, name: title } : s))
        );
      }
    } catch (error) {
      console.error('Error summarizing title:', error);
    }
  };

  // Let's update the handleSend function and regenerateMessage function to add API keys to requests
  const getApiKeyForProvider = (providerName: string): string | undefined => {
    if (typeof window !== 'undefined') {
      try {
        const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
        return savedKeys[providerName];
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
      const textFiles = uploadedFiles.filter(f => f.content);
      const otherFiles = uploadedFiles.filter(f => !f.type.startsWith('image/') && !f.content);
      
      // 处理文本文件
      if (textFiles.length > 0) {
        additionalContent += '\n\n--- 上传的文件内容 ---\n';
        textFiles.forEach(file => {
          additionalContent += `\n[文件: ${file.name}]\n${file.content}\n`;
        });
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
          const contentParts = [{ type: 'text', text: input + additionalContent }];
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
            
            // The API now returns direct JSON objects rather than {type, data} format
            // Extract data directly from the parsed JSON since it doesn't have the expected format
            if (parsedSSE.content) {
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
              if (stepType === 'thinking_step' && eventData.content) {
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

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      let content = '';
      
      // 对于文本文件，解码内容
      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const base64Content = result.split(',')[1]; // 移除data:text/plain;base64,前缀
        content = atob(base64Content);
      }
      
      const newFile: UploadedFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        content: content || undefined
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
      console.log('File uploaded:', file.name, file.type, 'Size:', file.size);
    };
    reader.readAsDataURL(file);
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
            
            // The API now returns direct JSON objects rather than {type, data} format
            // Extract data directly from the parsed JSON since it doesn't have the expected format
            if (parsedSSE.content) {
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
              if (stepType === 'thinking_step' && eventData.content) {
                reasoningBuffer += `${eventData.content}\n`;
                updateAssistantMessage(currentSessionId, messageId, accumulatedResponse, reasoningBuffer, true);
              } else if (stepType === 'thinking_step' && eventData.reasoning_content) {
                reasoningBuffer += `${eventData.reasoning_content}\n`;
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
        isOpen={isSidebarOpen}
      />
      
      {/* Main Content Area - Add margin-left when sidebar is open */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
        isSidebarOpen ? 'ml-80' : 'ml-0'
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
        
        {/* Content Container - Remove extra margins and center properly */}
        <div className="flex flex-col flex-1 items-center w-full px-4 py-6">
          <div className="w-full max-w-4xl">
            {/* Model Selector and Settings */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 mb-6 shadow-xl">
              <div className="flex flex-col gap-4">
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

            {/* Message List Area */}
            <div className={`flex flex-col flex-1 bg-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden mb-6 ${
              currentSession?.messages.length === 0 ? 'min-h-[60vh]' : 'min-h-[55vh] max-h-[70vh]'
            }`}>
              {currentSession?.messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12s3.86-8.25 8.625-8.25S21 7.444 21 12z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-200 mb-2">How can I help you today?</h2>
                  <p className="text-slate-400">Start a conversation with your AI assistant</p>
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

