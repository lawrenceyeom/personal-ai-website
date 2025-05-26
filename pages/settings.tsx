import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface ApiKeys {
  gpt?: string;
  claude?: string;
  gemini?: string;
  deepseek?: string;
  grok?: string;
}

interface NetworkSettings {
  bypassProxy: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>({ bypassProxy: false });
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Load settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedKeys = JSON.parse(localStorage.getItem('api_keys') || '{}');
        setApiKeys(savedKeys);
        
        const savedOptions = JSON.parse(localStorage.getItem('api_options') || '{}');
        setNetworkSettings({ bypassProxy: savedOptions.bypassProxy || false });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('api_keys', JSON.stringify(apiKeys));
      localStorage.setItem('api_options', JSON.stringify(networkSettings));
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('Error saving settings');
    }
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const updateApiKey = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const providers = [
    { id: 'gpt', name: 'OpenAI (GPT/o1/o3/o4)', icon: '🤖', placeholder: 'sk-...' },
    { id: 'claude', name: 'Anthropic (Claude)', icon: '🎭', placeholder: 'sk-ant-...' },
    { id: 'gemini', name: 'Google (Gemini)', icon: '💎', placeholder: 'AIzaSy...' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍', placeholder: 'sk-...' },
    { id: 'grok', name: 'xAI (Grok)', icon: '🚀', placeholder: 'xai-...' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </button>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <div className="w-24"></div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* API Keys Section */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            API Keys
          </h2>
          
          <div className="space-y-4">
            {providers.map(provider => (
              <div key={provider.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <h3 className="text-white font-medium">{provider.name}</h3>
                  </div>
                  <button
                    onClick={() => toggleShowKey(provider.id)}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {showKeys[provider.id] ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    value={apiKeys[provider.id as keyof ApiKeys] || ''}
                    onChange={(e) => updateApiKey(provider.id, e.target.value)}
                    placeholder={provider.placeholder}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  />
                  {apiKeys[provider.id as keyof ApiKeys] && (
                    <button
                      onClick={() => updateApiKey(provider.id, '')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-700/30">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> Your API keys are stored locally in your browser and never sent to our servers. 
              Some providers have default test keys for demo purposes.
            </p>
          </div>
        </div>

        {/* Network Settings Section */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Network Settings
          </h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors">
              <div>
                <p className="text-white font-medium">Bypass Proxy</p>
                <p className="text-sm text-slate-400 mt-1">
                  Connect directly to APIs without using proxy (useful for DeepSeek in mainland China)
                </p>
              </div>
              <input
                type="checkbox"
                checked={networkSettings.bypassProxy}
                onChange={(e) => setNetworkSettings({ ...networkSettings, bypassProxy: e.target.checked })}
                className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {saveStatus && (
              <p className={`text-sm ${saveStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {saveStatus}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
} 