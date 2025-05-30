// utils/network/proxy.ts
// 网络代理配置管理

import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpsProxyAgent as HpHttpsProxyAgent } from 'hpagent';

export interface ProxyConfig {
  enabled: boolean;
  url: string;
  timeout: number;
}

export class ProxyManager {
  private static instance: ProxyManager;
  private config: ProxyConfig;
  private httpsAgent: any = null;

  private constructor() {
    this.config = this.loadProxyConfig();
    this.initializeProxy();
  }

  public static getInstance(): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager();
    }
    return ProxyManager.instance;
  }

  private loadProxyConfig(): ProxyConfig {
    const proxyUrl = process.env.PROXY_URL || 'http://localhost:7890';
    
    // 🔧 修复：在生产环境中完全禁用代理，确保Render部署正常工作
    let useProxy = false;
    if (process.env.NODE_ENV === 'production') {
      // 生产环境（如Render）不使用代理
      useProxy = false;
      console.log('🌐 生产环境检测到，代理已禁用');
    } else {
      // 开发环境默认启用代理（本地开发需要）
      useProxy = process.env.USE_PROXY !== 'false'; // 允许本地开发时通过环境变量禁用
      console.log('🛠 开发环境检测到，代理状态:', useProxy ? '启用' : '禁用');
    }

    return {
      enabled: useProxy,
      url: proxyUrl,
      timeout: parseInt(process.env.API_TIMEOUT_MS || '60000', 10)
    };
  }

  private initializeProxy(): void {
    if (typeof window !== 'undefined') {
      // 客户端环境不配置代理
      console.log('🖥 客户端环境：代理配置跳过');
      return;
    }

    if (!this.config.enabled) {
      console.log('🚫 代理已禁用');
      this.httpsAgent = null; // 确保agent为null
      return;
    }

    try {
      this.httpsAgent = new HttpsProxyAgent(this.config.url);
      console.log(`✅ 代理已配置：${this.config.url}`);
      
      // 设置环境变量（向后兼容）
      process.env.HTTP_PROXY = process.env.HTTP_PROXY || this.config.url;
      process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || this.config.url;
      
    } catch (error: any) {
      console.error('❌ 代理配置失败:', error.message);
      this.httpsAgent = null;
    }
  }

  /**
   * 获取标准代理Agent（用于axios）
   */
  public getHttpsAgent(): any {
    // 🔧 修复：在生产环境中始终返回null，确保不使用代理
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    return this.httpsAgent;
  }

  /**
   * 获取fetch代理Agent（用于node-fetch）
   */
  public getFetchAgent(): any {
    // 🔧 修复：在生产环境或客户端环境中始终返回null
    if (process.env.NODE_ENV === 'production' || typeof window !== 'undefined') {
      return null;
    }

    if (!this.config.enabled) {
      return null;
    }

    try {
      return new HpHttpsProxyAgent({
        proxy: this.config.url,
        timeout: this.config.timeout,
      });
    } catch (error: any) {
      console.error('❌ Fetch代理Agent创建失败:', error.message);
      return null;
    }
  }

  /**
   * 创建axios配置对象
   */
  public getAxiosConfig(baseConfig: any = {}): any {
    const config = { ...baseConfig };
    
    // 🔧 修复：只在开发环境且代理启用时才添加代理配置
    if (process.env.NODE_ENV !== 'production' && this.config.enabled && this.httpsAgent) {
      config.httpsAgent = this.httpsAgent;
      console.log('🔧 Axios代理配置已添加');
    } else {
      console.log('🌐 Axios直连模式（无代理）');
    }
    
    config.timeout = config.timeout || this.config.timeout;
    
    return config;
  }

  /**
   * 创建fetch配置对象
   */
  public getFetchConfig(baseConfig: any = {}): any {
    const config = { ...baseConfig };
    
    // 🔧 修复：只在开发环境且代理启用时才添加代理配置
    if (process.env.NODE_ENV !== 'production') {
      const agent = this.getFetchAgent();
      if (agent) {
        config.agent = agent;
        console.log('🔧 Fetch代理配置已添加');
      } else {
        console.log('🌐 Fetch直连模式（无代理）');
      }
    } else {
      console.log('🌐 生产环境Fetch直连模式（无代理）');
    }
    
    return config;
  }

  /**
   * 检查代理是否启用
   */
  public isEnabled(): boolean {
    // 🔧 修复：生产环境中始终返回false
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return this.config.enabled;
  }

  /**
   * 获取代理URL
   */
  public getProxyUrl(): string {
    return this.config.url;
  }

  /**
   * 获取超时时间
   */
  public getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * 更新代理配置
   */
  public updateConfig(newConfig: Partial<ProxyConfig>): void {
    // 🔧 修复：生产环境中不允许启用代理
    if (process.env.NODE_ENV === 'production' && newConfig.enabled) {
      console.warn('⚠️ 生产环境中不允许启用代理，配置被忽略');
      return;
    }
    
    this.config = { ...this.config, ...newConfig };
    this.initializeProxy();
  }
}

// 导出单例实例
export const proxyManager = ProxyManager.getInstance(); 