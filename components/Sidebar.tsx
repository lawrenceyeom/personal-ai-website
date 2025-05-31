// Sidebar.tsx
// Enhanced professional sidebar with search, categorization, and modern design
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChatSession } from '../interfaces';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onBatchDeleteSessions?: (sessionIds: string[]) => void;
  isOpen: boolean;
}

export default function Sidebar({ 
  sessions, 
  currentSessionId, 
  onNewSession, 
  onSwitchSession,
  onArchiveSession,
  onDeleteSession,
  onBatchDeleteSessions,
  isOpen 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  
  // 🔧 添加存储管理状态
  const [storageInfo, setStorageInfo] = useState({
    usedMB: 0,
    totalMB: 10,
    percentage: 0,
    sessionCount: 0,
    // 🔧 新增：详细存储分析
    textSizeMB: 0,
    imageSizeMB: 0,
    fileSizeMB: 0,
    actualQuotaMB: 0,
    estimationMethod: 'default'
  });
  const [showStorageDetails, setShowStorageDetails] = useState(false);

  // 🔧 智能检测localStorage实际配额
  const detectActualStorageQuota = async (): Promise<{ quotaMB: number, method: string }> => {
    try {
      // 方法1: 使用Storage API获取实际配额（最准确）
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.quota > 0) {
          const quotaMB = estimate.quota / (1024 * 1024);
          // localStorage通常是总配额的一个子集
          const localStorageQuota = Math.min(quotaMB * 0.1, 100); // 约10%或最大100MB
          console.log(`📊 Storage API检测: 总配额${quotaMB.toFixed(2)}MB, LocalStorage估算${localStorageQuota.toFixed(2)}MB`);
          return { quotaMB: localStorageQuota, method: 'Storage API' };
        }
      }

      // 方法2: 实际测试localStorage容量（较准确但有性能开销）
      try {
        const testKey = 'storage_test_key';
        const testChunk = 'a'.repeat(1024 * 1024); // 1MB测试数据
        let testSize = 0;
        
        // 快速测试（最多测试到50MB）
        for (let i = 1; i <= 50; i++) {
          try {
            localStorage.setItem(testKey, testChunk.repeat(i));
            testSize = i;
          } catch {
            break;
          }
        }
        
        // 清理测试数据
        localStorage.removeItem(testKey);
        
        if (testSize > 0) {
          console.log(`📊 实际测试检测: LocalStorage可用容量约${testSize}MB`);
          return { quotaMB: testSize, method: '实际测试' };
        }
      } catch (testError) {
        console.warn('存储容量测试失败:', testError);
      }

      // 方法3: 基于浏览器类型的智能估算（兜底方案）
      const userAgent = navigator.userAgent.toLowerCase();
      let quotaMB = 10; // 默认值
      
      if (userAgent.includes('chrome') || userAgent.includes('edge')) {
        quotaMB = 50; // Chrome/Edge较为宽松
      } else if (userAgent.includes('firefox')) {
        quotaMB = 30; // Firefox中等
      } else if (userAgent.includes('safari')) {
        quotaMB = 20; // Safari相对保守
      } else if (userAgent.includes('opera')) {
        quotaMB = 25; // Opera中等偏上
      }
      
      console.log(`📊 浏览器估算: ${userAgent.split(' ')[0]} -> ${quotaMB}MB`);
      return { quotaMB, method: '浏览器估算' };
      
    } catch (error) {
      console.warn('配额检测失败，使用默认值:', error);
      return { quotaMB: 10, method: '默认值' };
    }
  };

  // 🔧 分析存储内容的详细组成
  const analyzeStorageContent = (sessionsData: string) => {
    try {
      const sessions = JSON.parse(sessionsData);
      let textSize = 0;
      let imageSize = 0;
      let fileSize = 0;

      sessions.forEach((session: any) => {
        session.messages?.forEach((message: any) => {
          // 分析文本内容大小
          if (typeof message.content === 'string') {
            textSize += new Blob([message.content]).size;
          }
          
          // 分析思考过程大小
          if (message.thinking) {
            textSize += new Blob([message.thinking]).size;
          }
          
          // 分析图片大小
          if (message.imageUrl) {
            imageSize += new Blob([message.imageUrl]).size;
          }
          
          // 分析文件大小
          if (message.files && Array.isArray(message.files)) {
            message.files.forEach((file: any) => {
              if (file.url) {
                // base64图片文件
                imageSize += new Blob([file.url]).size;
              } else if (file.content) {
                // 文本文件内容
                fileSize += new Blob([file.content]).size;
              }
            });
          }
          
          // 分析搜索结果大小
          if (message.searchResults) {
            textSize += new Blob([JSON.stringify(message.searchResults)]).size;
          }
        });
      });

      return {
        textSizeMB: textSize / (1024 * 1024),
        imageSizeMB: imageSize / (1024 * 1024),
        fileSizeMB: fileSize / (1024 * 1024)
      };
    } catch (error) {
      console.error('存储内容分析失败:', error);
      return { textSizeMB: 0, imageSizeMB: 0, fileSizeMB: 0 };
    }
  };

  // 🔧 优化的存储使用情况计算
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateStorageInfo = async () => {
        try {
          const sessionsData = localStorage.getItem('chat_sessions') || '[]';
          const totalSizeBytes = new Blob([sessionsData]).size;
          const usedMB = totalSizeBytes / (1024 * 1024);
          
          // 检测实际配额
          const quotaInfo = await detectActualStorageQuota();
          
          // 分析存储内容组成
          const contentAnalysis = analyzeStorageContent(sessionsData);
          
          const percentage = (usedMB / quotaInfo.quotaMB) * 100;
          
          setStorageInfo({
            usedMB: usedMB,
            totalMB: quotaInfo.quotaMB,
            percentage: Math.min(percentage, 100),
            sessionCount: sessions.length,
            textSizeMB: contentAnalysis.textSizeMB,
            imageSizeMB: contentAnalysis.imageSizeMB,
            fileSizeMB: contentAnalysis.fileSizeMB,
            actualQuotaMB: quotaInfo.quotaMB,
            estimationMethod: quotaInfo.method
          });
          
          console.log(`📊 存储分析完成:`, {
            总大小: `${usedMB.toFixed(2)}MB`,
            配额: `${quotaInfo.quotaMB}MB (${quotaInfo.method})`,
            使用率: `${percentage.toFixed(1)}%`,
            文本: `${contentAnalysis.textSizeMB.toFixed(2)}MB`,
            图片: `${contentAnalysis.imageSizeMB.toFixed(2)}MB`,
            文件: `${contentAnalysis.fileSizeMB.toFixed(2)}MB`
          });
          
        } catch (error) {
          console.error('Error calculating storage usage:', error);
        }
      };
      
      updateStorageInfo();
    }
  }, [sessions]);

  // 🔧 获取存储状态的颜色和状态
  const getStorageStatus = () => {
    if (storageInfo.percentage < 60) {
      return { color: 'text-green-400', bgColor: 'bg-green-400', status: '充足' };
    } else if (storageInfo.percentage < 75) {
      return { color: 'text-yellow-400', bgColor: 'bg-yellow-400', status: '适中' };
    } else if (storageInfo.percentage < 90) {
      return { color: 'text-orange-400', bgColor: 'bg-orange-400', status: '紧张' };
    } else {
      return { color: 'text-red-400', bgColor: 'bg-red-400', status: '危险' };
    }
  };

  const storageStatus = getStorageStatus();

  // 🔧 智能清理存储空间
  const quickCleanStorage = () => {
    const archivedCount = sessions.filter(s => s.archived).length;
    const oldSessionsCount = sessions.filter(s => Date.now() - s.lastUpdated > 7 * 24 * 60 * 60 * 1000).length; // 7天前的会话
    const imageHeavySessions = sessions.filter(s => 
      s.messages.some(m => m.imageUrl || (m.files && m.files.some((f: any) => f.url)))
    ).length;
    
    let message = '🧹 智能存储空间清理\n\n';
    message += `📊 当前状态:\n`;
    message += `• 总使用: ${storageInfo.usedMB.toFixed(2)}MB / ${storageInfo.totalMB}MB (${storageInfo.percentage.toFixed(1)}%)\n`;
    message += `• 文本内容: ${storageInfo.textSizeMB.toFixed(2)}MB\n`;
    message += `• 图片文件: ${storageInfo.imageSizeMB.toFixed(2)}MB\n`;
    message += `• 其他文件: ${storageInfo.fileSizeMB.toFixed(2)}MB\n\n`;
    
    message += `🔧 可清理项目:\n`;
    if (archivedCount > 0) {
      message += `• 删除 ${archivedCount} 个归档会话\n`;
    }
    if (oldSessionsCount > 0) {
      message += `• 删除 ${oldSessionsCount} 个7天前的会话\n`;
    }
    if (imageHeavySessions > 0) {
      message += `• 压缩 ${imageHeavySessions} 个包含图片的会话\n`;
    }
    if (sessions.length > 30) {
      message += `• 只保留最近30个会话（当前${sessions.length}个）\n`;
    }
    
    message += '\n选择清理策略:';
    
    // 提供多种清理选项
    const cleanupOptions = [];
    if (archivedCount > 0) cleanupOptions.push('归档会话');
    if (oldSessionsCount > 0) cleanupOptions.push('旧会话');
    if (imageHeavySessions > 0) cleanupOptions.push('图片压缩');
    if (sessions.length > 30) cleanupOptions.push('超量会话');
    
    const selectedOption = prompt(
      message + '\n\n输入数字选择清理策略:\n' +
      cleanupOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n') +
      '\n0. 全部清理\n' +
      '\n请输入选择 (1-' + cleanupOptions.length + ' 或 0):'
    );
    
    if (selectedOption === null) return; // 用户取消
    
    const optionIndex = parseInt(selectedOption);
    let toDelete: string[] = [];
    let cleanupType = '';
    
    if (optionIndex === 0) {
      // 全部清理 - 按优先级执行
      if (archivedCount > 0) {
        toDelete = sessions.filter(s => s.archived).map(s => s.id);
        cleanupType = '归档会话';
      } else if (oldSessionsCount > 0) {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        toDelete = sessions.filter(s => s.lastUpdated < weekAgo).map(s => s.id);
        cleanupType = '旧会话';
      } else if (sessions.length > 30) {
        const sorted = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
        toDelete = sorted.slice(30).map(s => s.id);
        cleanupType = '超量会话';
      }
    } else if (optionIndex >= 1 && optionIndex <= cleanupOptions.length) {
      const selectedCleanup = cleanupOptions[optionIndex - 1];
      
      if (selectedCleanup === '归档会话') {
        toDelete = sessions.filter(s => s.archived).map(s => s.id);
        cleanupType = '归档会话';
      } else if (selectedCleanup === '旧会话') {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        toDelete = sessions.filter(s => s.lastUpdated < weekAgo).map(s => s.id);
        cleanupType = '7天前的会话';
      } else if (selectedCleanup === '图片压缩') {
        // 图片压缩需要特殊处理，这里先提示用户
        alert('📸 图片压缩功能开发中\n\n将在后续版本中提供图片自动压缩和缩略图功能。\n\n当前建议删除包含大量图片的旧会话。');
        return;
      } else if (selectedCleanup === '超量会话') {
        const sorted = [...sessions].sort((a, b) => b.lastUpdated - a.lastUpdated);
        toDelete = sorted.slice(30).map(s => s.id);
        cleanupType = '超出30个的旧会话';
      }
    } else {
      alert('❌ 无效选择');
      return;
    }
    
    if (toDelete.length > 0 && onBatchDeleteSessions) {
      onBatchDeleteSessions(toDelete);
      alert(`✅ 已清理 ${toDelete.length} 个${cleanupType}，释放存储空间。`);
    } else {
      alert('💡 暂无可清理的会话。请考虑手动删除不需要的对话或使用其他清理选项。');
    }
  };

  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedSessions(new Set());
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const selectAllSessions = () => {
    const allSessionIds = new Set(sessions.map(s => s.id));
    setSelectedSessions(allSessionIds);
  };

  const deselectAllSessions = () => {
    setSelectedSessions(new Set());
  };

  const handleBatchDelete = () => {
    if (selectedSessions.size === 0) {
      alert('请选择要删除的对话');
      return;
    }

    const selectedCount = selectedSessions.size;
    const confirmMessage = `确定要删除选中的 ${selectedCount} 个对话吗？此操作不可撤销。`;
    
    if (confirm(confirmMessage)) {
      if (onBatchDeleteSessions) {
        onBatchDeleteSessions(Array.from(selectedSessions));
      }
      setSelectedSessions(new Set());
      setBatchMode(false);
    }
  };

  const handleClearAllSessions = () => {
    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      alert('没有可删除的会话');
      return;
    }

    const confirmMessage = `⚠️ 危险操作！\n\n确定要删除全部 ${totalSessions} 个对话吗？\n\n此操作将：\n• 删除所有历史对话记录\n• 清空聊天历史\n• 释放存储空间\n\n此操作不可撤销！`;
    
    if (confirm(confirmMessage)) {
      const secondConfirm = confirm('再次确认：真的要删除所有对话吗？');
      if (secondConfirm && onBatchDeleteSessions) {
        onBatchDeleteSessions(sessions.map(s => s.id));
        setBatchMode(false);
        setSelectedSessions(new Set());
      }
    }
  };

  // Categorize sessions
  const { todaySessions, yesterdaySessions, thisWeekSessions, olderSessions, archivedSessions } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    const filtered = sessions.filter(session => 
      session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.messages.some(msg => msg.content.toString().toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return {
      todaySessions: filtered.filter(s => !s.archived && s.lastUpdated >= todayStart),
      yesterdaySessions: filtered.filter(s => !s.archived && s.lastUpdated >= yesterdayStart && s.lastUpdated < todayStart),
      thisWeekSessions: filtered.filter(s => !s.archived && s.lastUpdated >= weekStart && s.lastUpdated < yesterdayStart),
      olderSessions: filtered.filter(s => !s.archived && s.lastUpdated < weekStart),
      archivedSessions: filtered.filter(s => s.archived)
    };
  }, [sessions, searchQuery]);

  const renderSessionGroup = (title: string, sessions: ChatSession[], icon: string) => {
    if (sessions.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
          <span>{icon}</span>
          <span>{title}</span>
          <span className="text-slate-600">({sessions.length})</span>
        </h3>
        <div className="space-y-1">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`group relative mx-2 rounded-lg transition-all duration-200 ${
                currentSessionId === session.id 
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 shadow-lg' 
                  : 'hover:bg-slate-800/50'
              } ${batchMode ? 'pr-12' : ''}`}
              onMouseEnter={() => setHoveredSession(session.id)}
              onMouseLeave={() => setHoveredSession(null)}
            >
              {/* 批量选择模式下的选择框 */}
              {batchMode && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.id)}
                    onChange={() => toggleSessionSelection(session.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
              )}

              <button
                onClick={() => batchMode ? toggleSessionSelection(session.id) : onSwitchSession(session.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  currentSessionId === session.id 
                    ? 'text-white' 
                    : 'text-slate-300 hover:text-white'
                } ${batchMode ? 'pl-8' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {session.messages.length} messages • {new Date(session.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                  {session.archived && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
                      Archived
                    </span>
                  )}
                </div>
              </button>
              
              {/* Action buttons on hover - 只在非批量模式下显示 */}
              {!batchMode && hoveredSession === session.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveSession(session.id);
                    }}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title={session.archived ? "Unarchive" : "Archive"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this conversation?')) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 transition-all duration-300 z-50 ${
      isOpen ? 'w-72 sm:w-80 translate-x-0' : 'w-72 sm:w-80 -translate-x-full'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <button
            onClick={onNewSession}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg mb-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>

          {/* 批量操作按钮区域 */}
          <div className="flex gap-2">
            {!batchMode ? (
              <button
                onClick={toggleBatchMode}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                title="批量管理对话"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                批量操作
              </button>
            ) : (
              <>
                {/* 批量操作模式下的控制按钮 */}
                <button
                  onClick={selectedSessions.size === sessions.length ? deselectAllSessions : selectAllSessions}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-colors"
                  title={selectedSessions.size === sessions.length ? "取消全选" : "全选"}
                >
                  {selectedSessions.size === sessions.length ? "取消全选" : "全选"}
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedSessions.size === 0}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                  title="删除选中的对话"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  删除({selectedSessions.size})
                </button>
                <button
                  onClick={toggleBatchMode}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-colors"
                  title="退出批量模式"
                >
                  退出
                </button>
              </>
            )}
          </div>

          {/* 清空所有会话按钮 - 独立区域 */}
          {sessions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <button
                onClick={handleClearAllSessions}
                className="w-full px-3 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-red-900/30"
                title="清空所有对话记录"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                清空所有会话 ({sessions.length})
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* 🔧 存储空间管理显示 */}
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            {/* 存储使用情况标题 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z" />
                </svg>
                <span className="text-xs font-medium text-slate-400">存储空间</span>
              </div>
              <button
                onClick={() => setShowStorageDetails(!showStorageDetails)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showStorageDetails ? '收起' : '详情'}
              </button>
            </div>
            
            {/* 存储使用进度条 */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-500">
                  {storageInfo.usedMB.toFixed(2)}MB / {storageInfo.totalMB}MB
                </span>
                <span className={`text-xs font-medium ${storageStatus.color}`}>
                  {storageStatus.status}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${storageStatus.bgColor}`}
                  style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {storageInfo.percentage.toFixed(1)}% 已使用
              </div>
            </div>
            
            {/* 详细信息和快速清理 */}
            {showStorageDetails && (
              <div className="space-y-3 border-t border-slate-700/50 pt-3">
                {/* 🔧 详细存储分析 */}
                <div className="text-xs text-slate-500 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-400">存储配额信息</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                      {storageInfo.estimationMethod}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>会话数量:</span>
                      <span className="text-slate-300">{storageInfo.sessionCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>归档会话:</span>
                      <span className="text-slate-300">{sessions.filter(s => s.archived).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>7天前会话:</span>
                      <span className="text-slate-300">
                        {sessions.filter(s => Date.now() - s.lastUpdated > 7 * 24 * 60 * 60 * 1000).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>图片会话:</span>
                      <span className="text-slate-300">
                        {sessions.filter(s => 
                          s.messages.some(m => m.imageUrl || (m.files && m.files.some((f: any) => f.url)))
                        ).length}
                      </span>
                    </div>
                  </div>
                  
                  {/* 🔧 存储内容分布 */}
                  <div className="border-t border-slate-700/50 pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-slate-400">存储分布</span>
                      <span className="text-xs text-slate-500">
                        {storageInfo.actualQuotaMB.toFixed(1)}MB 总配额
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      {/* 文本内容 */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          <span>文本内容</span>
                        </div>
                        <span className="text-slate-300">
                          {storageInfo.textSizeMB.toFixed(2)}MB 
                          <span className="text-slate-500 ml-1">
                            ({((storageInfo.textSizeMB / storageInfo.usedMB) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      
                      {/* 图片文件 */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span>图片文件</span>
                        </div>
                        <span className="text-slate-300">
                          {storageInfo.imageSizeMB.toFixed(2)}MB 
                          <span className="text-slate-500 ml-1">
                            ({((storageInfo.imageSizeMB / storageInfo.usedMB) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      
                      {/* 其他文件 */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span>其他文件</span>
                        </div>
                        <span className="text-slate-300">
                          {storageInfo.fileSizeMB.toFixed(2)}MB 
                          <span className="text-slate-500 ml-1">
                            ({((storageInfo.fileSizeMB / storageInfo.usedMB) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                    </div>
                    
                    {/* 可视化存储分布条 */}
                    <div className="mt-2">
                      <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-blue-400 float-left"
                          style={{ width: `${(storageInfo.textSizeMB / storageInfo.usedMB) * 100}%` }}
                        ></div>
                        <div 
                          className="h-full bg-green-400 float-left"
                          style={{ width: `${(storageInfo.imageSizeMB / storageInfo.usedMB) * 100}%` }}
                        ></div>
                        <div 
                          className="h-full bg-purple-400 float-left"
                          style={{ width: `${(storageInfo.fileSizeMB / storageInfo.usedMB) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 🔧 存储优化建议 */}
                {storageInfo.percentage > 50 && (
                  <div className="bg-slate-700/30 rounded-md p-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-slate-300">优化建议</span>
                    </div>
                    <div className="text-slate-400 space-y-0.5">
                      {storageInfo.imageSizeMB > storageInfo.textSizeMB && (
                        <div>• 图片占用较多，考虑删除旧图片会话</div>
                      )}
                      {sessions.filter(s => s.archived).length > 0 && (
                        <div>• 有 {sessions.filter(s => s.archived).length} 个归档会话可清理</div>
                      )}
                      {sessions.length > 30 && (
                        <div>• 会话数量较多，建议保留最近30个</div>
                      )}
                      {storageInfo.percentage > 85 && (
                        <div>• 空间紧张，建议立即清理</div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 快速清理按钮 */}
                {storageInfo.percentage > 40 && (
                  <button
                    onClick={quickCleanStorage}
                    className={`w-full px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2 border ${
                      storageInfo.percentage > 85 
                        ? 'bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 border-red-900/30' 
                        : 'bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 hover:text-blue-300 border-blue-900/30'
                    }`}
                    title="智能清理存储空间"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {storageInfo.percentage > 85 ? '紧急清理' : '智能清理'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {renderSessionGroup('Today', todaySessions, '📅')}
          {renderSessionGroup('Yesterday', yesterdaySessions, '📆')}
          {renderSessionGroup('This Week', thisWeekSessions, '📍')}
          {renderSessionGroup('Older', olderSessions, '📁')}
          
          {/* Archived Section */}
          {archivedSessions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-300 mb-2 px-3 w-full"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-90' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Archived ({archivedSessions.length})</span>
              </button>
              {showArchived && renderSessionGroup('', archivedSessions, '🗄️')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>© 2025 Personal AI</span>
            <span>•</span>
            <Link href="/settings" className="hover:text-slate-300 transition-colors">Settings</Link>
            <span>•</span>
            <button className="hover:text-slate-300 transition-colors">Help</button>
          </div>
        </div>
      </div>
    </div>
  );
} 