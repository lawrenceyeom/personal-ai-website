// ChatInput.tsx
// Enhanced professional chat input with better design and features
import React, { KeyboardEvent, useRef, useState } from 'react';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string; // For images
  content?: string; // For text files
  // 原生文档处理支持
  fileId?: string; // OpenAI file ID
  fileUri?: string; // Gemini file URI
  provider?: string; // 提供商名称
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onImageUpload?: (file: File) => void;
  onFileUpload?: (file: File) => void;
  disabled?: boolean;
  onCancel?: () => void;
  showCancel?: boolean;
  currentModel?: string;
  uploadedFiles?: UploadedFile[];
  onRemoveFile?: (fileId: string) => void;
  onSearchToggle?: (enabled: boolean) => void;
  isSearchEnabled?: boolean;
}

// 根据模型设置字符限制
const getCharacterLimit = (model?: string): number => {
  if (!model) return 20000;
  
  // 推理模型通常支持更长的输入
  if (model.includes('o1') || model.includes('o3') || model.includes('o4') || 
      model.includes('reasoner') || model.includes('r1') || 
      model.includes('grok-3') || model.includes('gemini-2.5')) {
    return 50000;
  }
  
  // Claude 4 和 Gemini 2.5 支持很长的上下文
  if (model.includes('claude-opus-4') || model.includes('claude-sonnet-4') || 
      model.includes('gemini-2.5')) {
    return 40000;
  }
  
  // GPT-4.1 系列
  if (model.includes('gpt-4.1')) {
    return 30000;
  }
  
  // 其他现代模型
  if (model.includes('gpt-4o') || model.includes('claude-3.5') || 
      model.includes('gemini-1.5') || model.includes('grok-2')) {
    return 25000;
  }
  
  // DeepSeek 和其他模型
  return 20000;
};

export default function ChatInput({ 
  value, 
  onChange, 
  onSend, 
  onImageUpload,
  onFileUpload,
  disabled,
  onCancel,
  showCancel,
  currentModel,
  uploadedFiles = [],
  onRemoveFile,
  onSearchToggle,
  isSearchEnabled
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const characterLimit = getCharacterLimit(currentModel);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim() && value.length <= characterLimit) {
        onSend();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file && onImageUpload) {
          onImageUpload(file);
          e.preventDefault();
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') && onImageUpload) {
        onImageUpload(file);
      } else if (onFileUpload) {
        onFileUpload(file);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    // 重置input值，允许重复选择同一文件
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // 重置input值，允许重复选择同一文件
    e.target.value = '';
  };

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const isOverLimit = value.length > characterLimit;

  return (
    <div 
      className={`relative ${isDragging ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File preview area */}
      {uploadedFiles.length > 0 && (
        <div className="mb-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-600/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-sm text-slate-300 font-medium">
              {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} attached
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-2 bg-slate-700/50 rounded-lg p-2 group">
                {/* File icon or image preview */}
                {file.type.startsWith('image/') && file.url ? (
                  <img 
                    src={file.url} 
                    alt={file.name}
                    className="w-8 h-8 rounded object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-slate-600 rounded flex items-center justify-center">
                    {/* 根据处理状态显示不同图标 */}
                    {file.content?.startsWith('🔄') ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : file.content?.startsWith('✅') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : file.content?.startsWith('⚠️') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : file.content?.startsWith('❌') ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                )}
                
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate font-medium">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB
                    {/* 显示提供商信息 */}
                    {file.provider && (
                      <span className="ml-1 px-1 py-0.5 bg-slate-600 rounded text-xs">
                        {file.provider}
                      </span>
                    )}
                  </p>
                </div>
                
                {/* Remove button */}
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(file.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-all duration-200"
                    title="Remove file"
                    disabled={file.content?.startsWith('🔄')} // 禁用上传中的文件删除
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-slate-700/50 shadow-xl p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Input area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={disabled ? "AI is thinking..." : "Type your message here... (Shift+Enter for new line)"}
              disabled={disabled}
              className={`w-full px-3 py-3 sm:px-4 lg:px-5 lg:py-4 bg-slate-800/50 border ${isOverLimit ? 'border-red-500' : 'border-slate-600/50'} rounded-lg sm:rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none min-h-[56px] sm:min-h-[60px] lg:min-h-[64px] max-h-[200px] lg:max-h-[240px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base`}
              rows={1}
            />
            
            {/* Loading indicator */}
            {disabled && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Image upload */}
              {onImageUpload && (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={disabled}
                    className="p-2 sm:p-2.5 lg:p-3 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Upload image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              )}

              {/* File upload */}
              {onFileUpload && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.csv,.rtf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="p-2 sm:p-2.5 lg:p-3 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Attach file"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </>
              )}

              {/* Voice input button */}
              <button
                disabled={disabled}
                className="p-2 sm:p-2.5 lg:p-3 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Voice input"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Search toggle button */}
              {onSearchToggle && (
                <button
                  onClick={() => onSearchToggle(!isSearchEnabled)}
                  disabled={disabled}
                  className={`relative p-2 sm:p-2.5 lg:p-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSearchEnabled 
                      ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300' 
                      : 'hover:bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                  title={isSearchEnabled ? "禁用网页搜索" : "启用网页搜索"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {isSearchEnabled && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Character count */}
              <span className={`text-xs sm:text-sm ${isOverLimit ? 'text-red-400' : 'text-slate-500'} hidden sm:block`}>
                {value.length.toLocaleString()} / {characterLimit.toLocaleString()}
              </span>

              {/* Cancel button */}
              {showCancel && onCancel && (
                <button
                  onClick={onCancel}
                  className="px-3 py-2 sm:px-4 lg:px-5 lg:py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg font-medium transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              )}

              {/* Send button */}
              <button
                onClick={onSend}
                disabled={disabled || !value.trim() || isOverLimit}
                className="px-4 py-2 sm:px-5 sm:py-2.5 lg:px-6 lg:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600 flex items-center gap-1 sm:gap-2 shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm rounded-2xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-blue-400 font-medium">Drop file here</p>
              <p className="text-blue-300 text-sm mt-1">
                支持: PDF, Word, PPT, Excel, 图片, 文本
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 