// pages/api/search.ts
// 搜索API接口 - 处理前端搜索请求（支持多模态内容）

import { NextApiRequest, NextApiResponse } from 'next';
import { SearchService, SearchConfig } from '../../utils/llm/search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, multimodalContent, config, stream = false } = req.body;

    // 验证必要参数
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Missing or invalid query parameter' 
      });
    }

    // 设置默认配置
    const searchConfig: SearchConfig = {
      enabled: true,
      maxResults: 15,
      language: 'zh-CN',
      ...config
    };

    // 从环境变量或请求中获取API密钥
    if (!searchConfig.apiKey) {
      searchConfig.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }

    if (!searchConfig.apiKey) {
      return res.status(400).json({ 
        error: 'Gemini API key not configured' 
      });
    }

    console.log('🔍 搜索请求:', {
      query: query.substring(0, 100),
      hasMultimodalContent: !!multimodalContent,
      multimodalType: multimodalContent ? (multimodalContent.parts ? 'parts' : 'text') : 'none',
      stream,
      hasApiKey: !!searchConfig.apiKey,
      maxResults: searchConfig.maxResults
    });

    // 创建搜索服务
    const searchService = new SearchService(searchConfig.apiKey);

    // 处理流式响应
    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 使用多模态搜索（如果有多模态内容）
      if (multimodalContent && multimodalContent.parts) {
        await searchService.searchMultimodalStream(query, multimodalContent, searchConfig, (data: string, type: string) => {
          try {
            const eventData = `data: ${data}\n\n`;
            res.write(eventData);
          } catch (error) {
            console.error('流式写入错误:', error);
          }
        });
      } else {
        await searchService.searchStream(query, searchConfig, (data: string, type: string) => {
          try {
            const eventData = `data: ${data}\n\n`;
            res.write(eventData);
          } catch (error) {
            console.error('流式写入错误:', error);
          }
        });
      }

      // 发送完成信号
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 处理非流式响应
    let searchResults;
    
    // 使用多模态搜索（如果有多模态内容）
    if (multimodalContent && multimodalContent.parts) {
      console.log('🔗 执行多模态搜索');
      searchResults = await searchService.searchMultimodal(query, multimodalContent, searchConfig);
    } else {
      console.log('📝 执行文本搜索');
      searchResults = await searchService.search(query, searchConfig);
    }
    
    console.log('✅ 搜索完成:', {
      success: searchResults.success,
      resultsCount: searchResults.results.length,
      hasError: !!searchResults.error,
      multimodal: !!(multimodalContent && multimodalContent.parts)
    });

    res.status(200).json(searchResults);

  } catch (error: any) {
    console.error('❌ 搜索API错误:', error);
    
    // 返回错误响应
    res.status(500).json({
      success: false,
      results: [],
      summary: '',
      searchQueries: [],
      error: error.message || 'Internal server error'
    });
  }
}

// 配置API路由
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',  // 增加大小限制以支持图片数据
    },
    responseLimit: false,
  },
}; 