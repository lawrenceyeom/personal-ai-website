// Sidebar.tsx
// Enhanced professional sidebar with search, categorization, and modern design
import React, { useState, useMemo } from 'react';
import { ChatSession } from '../interfaces';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isOpen: boolean;
}

export default function Sidebar({ 
  sessions, 
  currentSessionId, 
  onNewSession, 
  onSwitchSession,
  onArchiveSession,
  onDeleteSession,
  isOpen 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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
              }`}
              onMouseEnter={() => setHoveredSession(session.id)}
              onMouseLeave={() => setHoveredSession(null)}
            >
              <button
                onClick={() => onSwitchSession(session.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  currentSessionId === session.id 
                    ? 'text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
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
              
              {/* Action buttons on hover */}
              {hoveredSession === session.id && (
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
    <div className={`fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 transition-all duration-300 z-40 ${
      isOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'
    }`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <button
            onClick={onNewSession}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
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
            <a href="/settings" className="hover:text-slate-300 transition-colors">Settings</a>
            <span>•</span>
            <button className="hover:text-slate-300 transition-colors">Help</button>
          </div>
        </div>
      </div>
    </div>
  );
} 