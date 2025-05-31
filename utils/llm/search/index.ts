// utils/llm/search/index.ts
// 搜索模块 - 集成Gemini API的Google Search工具

import { BaseLLMProvider } from '../core/base-provider';
import { LLMRequest, StreamCallback, StreamChunkType } from '../core/types';
import { GeminiProvider } from '../providers/gemini';

export interface SearchConfig {
  enabled: boolean;
  apiKey?: string;
  maxResults?: number;
  language?: string;
  searchQuery?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  searchQueries?: string[];
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  summary: string;
  searchQueries: string[];
  error?: string;
}

/**
 * 搜索服务类
 * 封装Gemini API的Google Search工具功能
 */
export class SearchService {
  private geminiProvider: GeminiProvider;

  constructor(apiKey?: string) {
    this.geminiProvider = new GeminiProvider(apiKey);
  }

  /**
   * 执行搜索并总结结果
   * @param query 搜索查询
   * @param config 搜索配置
   * @returns 搜索结果和AI总结
   */
  async search(query: string, config: SearchConfig = { enabled: true }): Promise<SearchResponse> {
    try {
      if (!config.enabled) {
        return {
          success: false,
          results: [],
          summary: '',
          searchQueries: [],
          error: '搜索功能未启用'
        };
      }

      // 构建搜索请求 - 使用Gemini 2.0的新格式
      const searchRequest: LLMRequest = {
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'user',
            content: this.buildSearchPrompt(query, config)
          }
        ],
        tools: [
          {
            google_search: {}  // 使用Gemini 2.0的新格式
          }
        ],
        apiKey: config.apiKey,
        temperature: 0.3,
        max_tokens: 2048
      };

      console.log('🔍 搜索请求配置:', {
        model: searchRequest.model,
        toolsCount: searchRequest.tools?.length,
        tools: searchRequest.tools,
        hasApiKey: !!searchRequest.apiKey
      });

      // 调用Gemini API
      const response = await this.geminiProvider.callNonStream(searchRequest);
      
      console.log('🔍 Gemini搜索响应:', {
        hasContent: !!response.content,
        contentLength: response.content?.length,
        hasToolCalls: !!response.tool_calls,
        toolCallsCount: response.tool_calls?.length
      });
      
      // 解析响应
      return this.parseSearchResponse(response, query);

    } catch (error: any) {
      console.error('🔍 Search error:', error);
      return {
        success: false,
        results: [],
        summary: '',
        searchQueries: [],
        error: error.message || '搜索失败'
      };
    }
  }

  /**
   * 流式搜索（用于实时更新UI）
   * @param query 搜索查询
   * @param config 搜索配置
   * @param onData 流式数据回调
   * @returns Promise
   */
  async searchStream(
    query: string, 
    config: SearchConfig, 
    onData: StreamCallback
  ): Promise<void> {
    if (!config.enabled) {
      onData(JSON.stringify({
        error: '搜索功能未启用'
      }), 'error');
      return;
    }

    const searchRequest: LLMRequest = {
      model: 'gemini-2.0-flash',
      messages: [
        {
          role: 'user',
          content: this.buildSearchPrompt(query, config)
        }
      ],
      tools: [
        {
          google_search: {}
        }
      ],
      apiKey: config.apiKey,
      temperature: 0.3,
      max_tokens: 6144,
      response_format: { type: 'json_object' }
    };

    // 发送开始搜索的状态
    onData(JSON.stringify({
      type: 'search_start',
      query: query
    }), 'content_chunk');

    try {
      await this.geminiProvider.callStream(searchRequest, (data: string, type: string) => {
        // 转发流式数据，添加搜索标识
        if (type === 'content_chunk') {
          onData(data, 'content_chunk');
        } else if (type === 'tool_use_step') {
          onData(JSON.stringify({
            type: 'search_tool_use',
            data: JSON.parse(data)
          }), 'tool_use_step');
        } else {
          onData(data, type as StreamChunkType);
        }
      });

      // 发送搜索完成状态
      onData(JSON.stringify({
        type: 'search_complete',
        query: query
      }), 'content_chunk');

    } catch (error: any) {
      onData(JSON.stringify({
        type: 'search_error',
        error: error.message || '搜索失败'
      }), 'error');
    }
  }

  /**
   * 构建搜索提示词
   */
  private buildSearchPrompt(query: string, config: SearchConfig): string {
    const maxResults = config.maxResults || 10;
    const language = config.language || 'zh-CN';

    return `你是一个专业的信息搜索助手。你的任务是为后续的AI模型提供准确、全面的搜索信息，而不是直接回答用户问题。

用户查询：${query}

请使用Google搜索工具搜索相关信息，并按以下格式整理搜索结果：

**重要说明：**
- 你的角色是信息收集者，不是问题解答者
- 请提供原始搜索信息，不要进行过度分析或总结
- 后续会有专门的AI模型基于你提供的信息来回答用户问题

**返回格式要求：**
请按以下结构整理搜索结果：

## 搜索结果

### [结果1标题]
**日期：** [发布日期或最后更新日期]
**来源：** [网站名称/机构] 
**链接：** [完整URL]
**内容：** [详细内容摘要，包含关键数据、事实和具体信息，要足够详细]

### [结果2标题]
**日期：** [发布日期或最后更新日期]
**来源：** [网站名称/机构]
**链接：** [完整URL]  
**内容：** [详细内容摘要，包含关键数据、事实和具体信息，要足够详细]

[继续其他结果...]

**搜索要求：**
1. 优先搜索${language}内容，但也包含重要的英文资源
2. 关注最新信息和权威来源
3. 包含具体数据、时间、地点等详细信息
4. 保持信息的客观性和完整性
5. 每个结果都要包含明确的日期和来源信息
6. 如果用户明确需要某些原文信息，请在结果中包含搜索到的完整原文信息

请开始搜索并按要求格式整理信息。`;
  }

  /**
   * 解析搜索响应 - 增强版本，支持从格式化文本中提取结构化数据
   */
  private parseSearchResponse(response: any, originalQuery: string): SearchResponse {
    try {
      console.log('🔍 解析搜索响应:', {
        responseType: typeof response,
        hasContent: !!response.content,
        hasToolCalls: !!response.tool_calls,
        responseKeys: Object.keys(response)
      });

      // 从不同的响应格式中提取内容
      let content = '';
      if (response.content) {
        content = response.content;
      } else if (response.text) {
        content = response.text;
      } else if (response.choices && response.choices[0]?.message?.content) {
        content = response.choices[0].message.content;
      }

      if (!content) {
        console.warn('⚠️ 搜索响应中没有找到内容');
        return {
          success: false,
          results: [],
          summary: '无法解析搜索响应',
          searchQueries: [originalQuery],
          error: '响应格式错误或为空'
        };
      }

      // 解析结构化的搜索结果
      const parsedResults = this.extractSearchResultsFromText(content);
      
      console.log('✅ 搜索结果解析完成:', {
        contentLength: content.length,
        extractedResultsCount: parsedResults.results.length,
        hasStructuredFormat: parsedResults.hasStructuredFormat,
        summaryLength: parsedResults.cleanSummary.length
      });

      return {
        success: true,
        results: parsedResults.results,
        summary: parsedResults.cleanSummary,
        searchQueries: [originalQuery],
        error: undefined
      };

    } catch (error: any) {
      console.error('❌ 解析搜索响应时出错:', error);
      
      return {
        success: false,
        results: [],
        summary: typeof response === 'string' ? response : '搜索解析失败',
        searchQueries: [originalQuery],
        error: `解析错误: ${error.message}`
      };
    }
  }

  /**
   * 从格式化文本中提取搜索结果
   */
  private extractSearchResultsFromText(content: string): {
    results: SearchResult[];
    cleanSummary: string;
    hasStructuredFormat: boolean;
  } {
    const results: SearchResult[] = [];
    let cleanSummary = content;
    let hasStructuredFormat = false;

    try {
      // 检测是否包含结构化的搜索结果
      const hasSearchResults = content.includes('## 搜索结果') || content.includes('## 多模态搜索结果');
      
      if (hasSearchResults) {
        hasStructuredFormat = true;
        
        // 提取搜索结果部分
        const searchSectionMatch = content.match(/## (?:多模态)?搜索结果\s*([\s\S]*?)(?=\n\n---|\n\n\*\*|$)/);
        
        if (searchSectionMatch) {
          const searchSection = searchSectionMatch[1];
          
          // 使用正则表达式提取每个搜索结果条目
          const resultPattern = /### ([^\n]+)\s*\*\*日期：\*\*\s*([^\n]*)\s*\*\*来源：\*\*\s*([^\n]*)\s*\*\*链接：\*\*\s*([^\n]*)\s*(?:\*\*相关性：\*\*\s*([^\n]*)\s*)?\*\*内容：\*\*\s*((?:[^\n]|\n(?!\s*###))*)/g;
          
          let match;
          while ((match = resultPattern.exec(searchSection)) !== null) {
            const [, title, date, source, link, relevance, contentText] = match;
            
            // 清理提取的内容
            const cleanTitle = title.trim();
            const cleanDate = date.trim();
            const cleanSource = source.trim();
            const cleanLink = link.replace(/^\[|\]|\(|\)$/g, '').trim(); // 移除Markdown链接格式
            const cleanContent = contentText.trim();
            
            // 创建搜索结果对象
            const searchResult: SearchResult = {
              title: cleanTitle,
              url: cleanLink,
              snippet: this.createSnippet(cleanContent, cleanDate, cleanSource, relevance),
              searchQueries: [cleanTitle]
            };
            
            results.push(searchResult);
            
            console.log(`📋 提取搜索结果 ${results.length}:`, {
              title: cleanTitle.substring(0, 50),
              source: cleanSource,
              hasContent: !!cleanContent,
              contentLength: cleanContent.length
            });
          }
          
          // 创建清理后的摘要（移除前导的搜索指令）
          cleanSummary = this.cleanSearchSummary(content, results.length);
        }
      } else {
        // 如果没有结构化格式，尝试从普通文本中提取信息
        console.log('⚠️ 未检测到结构化搜索格式，将原始内容作为摘要');
        cleanSummary = this.cleanSearchSummary(content, 0);
      }
      
    } catch (error) {
      console.error('❌ 提取搜索结果时出错:', error);
      cleanSummary = content;
    }

    return {
      results,
      cleanSummary,
      hasStructuredFormat
    };
  }

  /**
   * 创建搜索结果的snippet
   */
  private createSnippet(content: string, date: string, source: string, relevance?: string): string {
    let snippet = '';
    
    // 添加日期信息
    if (date) {
      snippet += `📅 ${date} `;
    }
    
    // 添加来源信息
    if (source) {
      snippet += `📰 ${source} `;
    }
    
    // 添加相关性信息（多模态搜索）
    if (relevance) {
      snippet += `🎯 ${relevance} `;
    }
    
    // 添加内容摘要（限制长度）
    if (content) {
      const contentPreview = content.length > 200 
        ? content.substring(0, 200) + '...' 
        : content;
      snippet += `📄 ${contentPreview}`;
    }
    
    return snippet.trim();
  }

  /**
   * 清理搜索摘要，移除不必要的前导文本
   */
  private cleanSearchSummary(content: string, resultCount: number): string {
    let cleanContent = content;
    
    try {
      // 移除搜索模型的前导指令
      const instructionPatterns = [
        /^好的，我将.*?按照.*?格式.*?搜索结果[。！]*\s*/,
        /^我将按照您的要求.*?搜索.*?信息[。！]*\s*/,
        /^根据您的要求.*?搜索.*?并.*?整理[。！]*\s*/,
        /^我来.*?搜索.*?相关信息[。！]*\s*/,
        /^我将.*?使用Google搜索工具.*?搜索.*?信息[。！]*\s*/
      ];
      
      for (const pattern of instructionPatterns) {
        cleanContent = cleanContent.replace(pattern, '');
      }
      
      // 如果有结构化结果，添加结果统计
      if (resultCount > 0) {
        cleanContent = `🔍 搜索完成，找到 ${resultCount} 条相关信息\n\n${cleanContent}`;
      }
      
      // 如果内容过长，进行智能截取
      if (cleanContent.length > 3000) {
        // 保留前2000字符和最后500字符
        const beginning = cleanContent.substring(0, 2000);
        const ending = cleanContent.substring(cleanContent.length - 500);
        cleanContent = beginning + '\n\n... [内容过长，已省略中间部分] ...\n\n' + ending;
      }
      
    } catch (error) {
      console.error('❌ 清理搜索摘要时出错:', error);
    }
    
    return cleanContent.trim();
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ],
        apiKey: apiKey,
        max_tokens: 10
      };

      await this.geminiProvider.callNonStream(testRequest);
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  /**
   * 多模态搜索 - 支持图片和文档
   * @param query 搜索查询
   * @param multimodalContent 多模态内容（images, files等）
   * @param config 搜索配置
   * @returns 搜索结果和AI总结
   */
  async searchMultimodal(
    query: string, 
    multimodalContent: any,
    config: SearchConfig = { enabled: true }
  ): Promise<SearchResponse> {
    try {
      if (!config.enabled) {
        return {
          success: false,
          results: [],
          summary: '',
          searchQueries: [],
          error: '搜索功能未启用'
        };
      }

      console.log('🔗 开始多模态搜索:', {
        query: query.substring(0, 100),
        hasMultimodalContent: !!multimodalContent,
        partsCount: multimodalContent.parts?.length || 0
      });

      // 构建多模态搜索请求
      const searchRequest: LLMRequest = {
        model: 'gemini-2.0-flash',
        messages: [
          {
            role: 'user',
            content: this.buildMultimodalSearchPrompt(query, multimodalContent, config)
          }
        ],
        tools: [
          {
            google_search: {}  // 使用Gemini 2.0的Google Search工具
          }
        ],
        apiKey: config.apiKey,
        temperature: 0.3,
        max_tokens: 8192  // 增加token数量以支持更详细的多模态响应
      };

      console.log('🔍 多模态搜索请求配置:', {
        model: searchRequest.model,
        toolsCount: searchRequest.tools?.length,
        hasApiKey: !!searchRequest.apiKey,
        contentType: typeof searchRequest.messages[0].content
      });

      // 调用Gemini API
      const response = await this.geminiProvider.callNonStream(searchRequest);
      
      console.log('🔍 Gemini多模态搜索响应:', {
        hasContent: !!response.content,
        contentLength: response.content?.length,
        hasToolCalls: !!response.tool_calls,
        toolCallsCount: response.tool_calls?.length
      });
      
      // 解析响应
      return this.parseSearchResponse(response, query);

    } catch (error: any) {
      console.error('🔍 多模态搜索错误:', error);
      return {
        success: false,
        results: [],
        summary: '',
        searchQueries: [],
        error: error.message || '多模态搜索失败'
      };
    }
  }

  /**
   * 流式多模态搜索
   * @param query 搜索查询
   * @param multimodalContent 多模态内容
   * @param config 搜索配置
   * @param onData 流式数据回调
   * @returns Promise
   */
  async searchMultimodalStream(
    query: string,
    multimodalContent: any,
    config: SearchConfig,
    onData: StreamCallback
  ): Promise<void> {
    if (!config.enabled) {
      onData(JSON.stringify({
        error: '搜索功能未启用'
      }), 'error');
      return;
    }

    const searchRequest: LLMRequest = {
      model: 'gemini-2.0-flash',
      messages: [
        {
          role: 'user',
          content: this.buildMultimodalSearchPrompt(query, multimodalContent, config)
        }
      ],
      tools: [
        {
          google_search: {}
        }
      ],
      apiKey: config.apiKey,
      temperature: 0.3,
      max_tokens: 6144
    };

    // 发送开始搜索的状态
    onData(JSON.stringify({
      type: 'multimodal_search_start',
      query: query,
      hasFiles: !!multimodalContent.parts?.some((p: any) => p.file_data),
      hasImages: !!multimodalContent.parts?.some((p: any) => p.inlineData)
    }), 'content_chunk');

    try {
      await this.geminiProvider.callStream(searchRequest, (data: string, type: string) => {
        // 转发流式数据，添加多模态搜索标识
        if (type === 'content_chunk') {
          onData(data, 'content_chunk');
        } else if (type === 'tool_use_step') {
          onData(JSON.stringify({
            type: 'multimodal_search_tool_use',
            data: JSON.parse(data)
          }), 'tool_use_step');
        } else {
          onData(data, type as StreamChunkType);
        }
      });

      // 发送搜索完成状态
      onData(JSON.stringify({
        type: 'multimodal_search_complete',
        query: query
      }), 'content_chunk');

    } catch (error: any) {
      onData(JSON.stringify({
        type: 'multimodal_search_error',
        error: error.message || '多模态搜索失败'
      }), 'error');
    }
  }

  /**
   * 构建多模态搜索提示词
   */
  private buildMultimodalSearchPrompt(query: string, multimodalContent: any, config: SearchConfig): any {
    const maxResults = config.maxResults || 10;
    const language = config.language || 'zh-CN';

    // 如果没有多模态内容，回退到文本搜索
    if (!multimodalContent || !multimodalContent.parts) {
      return this.buildSearchPrompt(query, config);
    }

    console.log('🔗 构建多模态搜索提示词:', {
      partsCount: multimodalContent.parts.length,
      partTypes: multimodalContent.parts.map((p: any) => Object.keys(p)).flat()
    });

    // 构建增强的多模态搜索指令
    const enhancedParts = [...multimodalContent.parts];
    
    // 更新第一个文本部分，包含更详细的搜索指令
    const firstTextPartIndex = enhancedParts.findIndex(part => part.text);
    if (firstTextPartIndex !== -1) {
      enhancedParts[firstTextPartIndex] = {
        text: `你是一个专业的多模态信息搜索助手。你的任务是基于用户提供的图片、文档和文本查询，搜索相关信息并为后续的AI模型提供详细资料。

用户查询：${query}

**你的任务：**
1. 仔细分析提供的图片和文档内容
2. 基于多模态内容理解用户的真实需求
3. 进行精准的网络搜索
4. 提供结构化的搜索结果，不要进行分析

**重要说明：**
- 你是信息收集助手，专注于搜索和整理信息
- 充分理解图片和文档中的关键元素
- 基于视觉和文本内容进行上下文相关的搜索
- 后续会有专门的AI模型基于你的搜索结果回答用户问题

**返回格式要求：**
请按以下结构整理搜索结果：

## 多模态搜索结果

### [结果1标题]
**日期：** [发布日期或最后更新日期]
**来源：** [网站名称/机构]
**链接：** [完整URL]
**相关性：** [与用户提供的图片/文档的关联度说明]
**内容：** [详细内容摘要，包含关键数据、事实和具体信息]

### [结果2标题]
**日期：** [发布日期或最后更新日期]  
**来源：** [网站名称/机构]
**链接：** [完整URL]
**相关性：** [与用户提供的图片/文档的关联度说明]
**内容：** [详细内容摘要，包含关键数据、事实和具体信息]

[继续其他结果...]

**搜索要求：**
1. 优先搜索${language}内容，但也包含重要的英文资源
2. 基于图片和文档内容进行精准匹配
3. 关注最新信息和权威来源  
4. 包含具体数据、时间、地点等关键信息
5. 保持信息的客观性和完整性
6. 说明搜索结果与提供内容的关联性
7. 如果用户明确需要某些原文信息，请在结果中包含搜索到的完整原文信息

请仔细分析以下提供的图片和文档内容，然后进行相关搜索：`
      };
    } else {
      // 如果没有找到文本部分，添加一个新的文本指令
      enhancedParts.unshift({
        text: `你是一个专业的多模态信息搜索助手。基于用户查询"${query}"和以下提供的图片/文档内容，请进行相关搜索并按结构化格式返回信息。你的任务是收集信息，不是回答问题。`
      });
    }

    return enhancedParts;
  }
}

/**
 * 搜索工具函数 - 便捷调用接口
 */
export async function performSearch(
  query: string, 
  config: SearchConfig = { enabled: true }
): Promise<SearchResponse> {
  const searchService = new SearchService(config.apiKey);
  return await searchService.search(query, config);
}

/**
 * 流式搜索工具函数
 */
export async function performSearchStream(
  query: string,
  config: SearchConfig,
  onData: StreamCallback
): Promise<void> {
  const searchService = new SearchService(config.apiKey);
  return await searchService.searchStream(query, config, onData);
}

/**
 * 合并搜索结果到用户消息 - 优化版本
 * @param userMessage 用户原始消息
 * @param searchResults 搜索结果
 * @returns 增强后的消息内容
 */
export function enhanceMessageWithSearch(
  userMessage: string,
  searchResults: SearchResponse
): string {
  if (!searchResults.success || !searchResults.summary) {
    return userMessage;
  }

  // 获取当前日期
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  
  const timeString = currentDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // 构建系统提示
  const systemPrompt = `

---

**系统提示：**

今天是${dateString} ${timeString}。系统已根据用户输入进行了网络搜索，以下是最新相关信息。请将以下信息作为你搜索到的最新资料，结合这些信息来回答用户的问题。

**重要说明：**
- 以下搜索信息来自实时网络搜索
- 请充分利用这些最新信息来提供准确、全面的回答
- 在回答中可以引用具体的数据、日期和来源
- 如果搜索信息与你的训练数据有冲突，请优先参考搜索信息

**搜索获得的最新信息：**

${searchResults.summary}`;

  // 如果有结构化的搜索结果，添加来源信息
  if (searchResults.results && searchResults.results.length > 0) {
    const sourcesList = searchResults.results
      .slice(0, 8) // 限制显示前8个来源，避免内容过长
      .map((result, index) => {
        return `${index + 1}. **${result.title}**
   - 来源：${result.url}
   - 摘要：${result.snippet || '详见链接内容'}`;
      })
      .join('\n\n');

    const sourcesSection = `

**主要参考来源：**

${sourcesList}`;

    return userMessage + systemPrompt + sourcesSection + `

---

**用户原始问题：** ${userMessage}

请基于以上最新搜索信息回答用户问题。`;
  }

  // 如果没有结构化结果，只返回基本格式
  return userMessage + systemPrompt + `

---

**用户原始问题：** ${userMessage}

请基于以上最新搜索信息回答用户问题。`;
}

export default SearchService; 