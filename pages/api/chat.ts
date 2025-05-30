import type { NextApiRequest, NextApiResponse } from 'next';
import { callLLMStream, LLMRequest } from '../../utils/llm';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // 支持最大10MB的请求体
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none'); // Important for SSE
  res.flushHeaders(); // Flush the headers to establish the connection early

  try {
    // 解析请求体，处理字符串和对象两种情况
    let parsedRequest: LLMRequest;
    if (typeof req.body === 'string') {
      parsedRequest = JSON.parse(req.body);
    } else {
      parsedRequest = req.body;
    }
    
    console.log('[API Chat DEBUG] Received request body');
    console.log('[API Chat DEBUG] Parsed request before api_options processing:', JSON.stringify(parsedRequest, null, 2));
      
      // Handle api_options properly
      if (parsedRequest.api_options) {
        console.log('[API Chat DEBUG] parsedRequest.api_options:', JSON.stringify(parsedRequest.api_options));
        
        // Skip connection check if explicitly set or defaulted to true
        parsedRequest.skip_connection_check = (parsedRequest.api_options.skipConnectionCheck === true);
        
        // Only bypass proxy if explicitly set to true
        if (parsedRequest.api_options.bypassProxy === true) {
          parsedRequest.bypass_proxy = true;
        }
        
        console.log('[API Chat DEBUG] Applied options - skip_connection_check:', 
                  parsedRequest.skip_connection_check, 
                  'bypass_proxy:', parsedRequest.bypass_proxy);
      } else {
        console.log('[API Chat DEBUG] No api_options found in request, using defaults');
        // Default to skip connection check for better reliability
        parsedRequest.skip_connection_check = true;
      }
      
      // Non-streaming request for title summarization
      if (parsedRequest.stream === false) {
        console.log('[API Chat DEBUG] Non-streaming request detected');
        let fullResponse = '';
        
        // Use a custom callback for non-streaming requests
        await callLLMStream(parsedRequest, (chunk, stepType) => {
          console.log('[API Chat DEBUG] Non-streaming chunk received:', chunk);
          try {
            const parsed = JSON.parse(chunk);
            // Collect content from non-streaming request
            if (parsed.content) {
              fullResponse += parsed.content;
            } else if (parsed.error) {
              res.write(`data: ${JSON.stringify({ error: parsed.error, details: parsed.details })}\n\n`);
              res.end();
            }
          } catch (e) {
            console.error('[API Chat DEBUG] Error parsing chunk in non-streaming mode:', e);
          }
        });
        
        console.log('[API Chat DEBUG] Non-streaming request completed, fullResponse:', fullResponse);
        
        // For title summarization, return the full text as "title"
        res.json({ title: fullResponse, content: fullResponse });
        return;
      }

      // For streaming requests
      console.log('[API Chat DEBUG] Streaming request, streaming response now...');

      await callLLMStream(parsedRequest, (chunk, stepType) => {
        console.log('[API Chat DEBUG] Stream chunk:', chunk, 'stepType:', stepType);
        
        // Format response as a proper SSE message - pass the chunk directly
        res.write(`data: ${chunk}\n\n`);
      });
      
      console.log('[API Chat DEBUG] Streaming completed, sending [DONE]');
      res.write('data: [DONE]\n\n');
      res.end();
  } catch (error: any) {
    console.error('[API Chat DEBUG] Error in API route:', error);
    res.write(`data: ${JSON.stringify({ 
      error: "API error", 
      details: error.message || "Unknown server error" 
    })}\n\n`);
    res.end();
  }
} 