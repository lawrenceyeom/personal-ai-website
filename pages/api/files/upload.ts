import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { getModelMapping } from '../../../utils/llm';
import { proxyManager } from '../../../utils/network/proxy';

export const config = {
  api: {
    bodyParser: false, // 禁用内置的body parser以处理文件上传
  },
};

// 文件上传结果
interface FileUploadResult {
  fileId?: string;
  fileUri?: string;
  mimeType?: string;
  error?: string;
  provider?: string;
}

// OpenAI文件上传
async function uploadToOpenAI(file: formidable.File, apiKey: string): Promise<FileUploadResult> {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    
    // 添加purpose字段 - 根据文档应该使用user_data
    form.append('purpose', 'user_data');
    
    // 添加文件，确保正确的文件流和元数据
    form.append('file', fs.createReadStream(file.filepath), {
      filename: file.originalFilename || 'document.pdf',
      contentType: file.mimetype || 'application/pdf',
    });

    // 使用node-fetch并配置代理
    const fetch = require('node-fetch');
    
    // 获取代理配置
    const fetchConfig = proxyManager.getFetchConfig({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    console.log('📡 OpenAI file upload with proxy:', proxyManager.isEnabled() ? 'enabled' : 'disabled');
    
    const response = await fetch('https://api.openai.com/v1/files', fetchConfig);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('OpenAI file upload success:', result);

    return {
      fileId: result.id,
      mimeType: file.mimetype || 'application/pdf',
      provider: 'openai',
    };
  } catch (error: any) {
    console.error('OpenAI file upload error:', error.message);
    return { 
      error: `OpenAI file upload failed: ${error.message}` 
    };
  }
}

// Gemini文件上传 - 使用Google Generative AI SDK风格的API
async function uploadToGemini(file: formidable.File, apiKey: string): Promise<FileUploadResult> {
  try {
    const fetch = require('node-fetch');
    
    // 读取文件数据
    const fileData = fs.readFileSync(file.filepath);
    
    console.log('📡 Gemini file upload with proxy:', proxyManager.isEnabled() ? 'enabled' : 'disabled');
    console.log('📄 Gemini file details:', {
      name: file.originalFilename,
      size: file.size,
      type: file.mimetype
    });
    
    // 使用简化的Files API上传 - 直接上传方式
    const FormData = require('form-data');
    const form = new FormData();
    
    // 设置文件元数据
    const metadata = {
      file: {
        display_name: file.originalFilename || 'document.pdf',
        mime_type: file.mimetype || 'application/pdf'
      }
    };
    
    // 添加元数据
    form.append('metadata', JSON.stringify(metadata), {
      contentType: 'application/json'
    });
    
    // 添加文件数据
    form.append('data', fileData, {
      filename: file.originalFilename || 'document.pdf',
      contentType: file.mimetype || 'application/pdf'
    });
    
    // 使用multipart上传API - 使用代理配置
    const uploadConfig = proxyManager.getFetchConfig({
      method: 'POST',
      headers: {
        ...form.getHeaders()
      },
      body: form
    });
    
    const uploadResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      uploadConfig
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Gemini upload error response:', errorText);
      throw new Error(`Gemini upload failed: ${uploadResponse.status} ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('✅ Gemini file upload result:', result);

    // 等待文件处理完成 - 使用代理配置
    const fileUri = result.file?.uri;
    if (!fileUri) {
      throw new Error('Failed to get file URI from Gemini response');
    }
    
    let fileState = result.file?.state || 'PROCESSING';
    let retries = 0;
    const maxRetries = 15; // 增加重试次数
    
    console.log('⏳ Waiting for Gemini file processing...');
    
    while (fileState === 'PROCESSING' && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const checkConfig = proxyManager.getFetchConfig({ method: 'GET' });
      const checkResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileUri}?key=${apiKey}`,
        checkConfig
      );
      
      if (checkResponse.ok) {
        const fileInfo = await checkResponse.json();
        fileState = fileInfo.state;
        console.log(`📊 Gemini file state: ${fileState}, retry: ${retries + 1}/${maxRetries}`);
        
        if (fileState === 'ACTIVE') {
          break;
        } else if (fileState === 'FAILED') {
          throw new Error(`Gemini file processing failed: ${fileInfo.error?.message || 'Unknown error'}`);
        }
      } else {
        console.warn('Failed to check file status:', checkResponse.status);
      }
      
      retries++;
    }

    if (fileState !== 'ACTIVE') {
      throw new Error(`Gemini file processing timeout. Final state: ${fileState}`);
    }

    console.log('🎉 Gemini file upload and processing completed successfully');

    return {
      fileUri: fileUri,
      mimeType: result.file?.mimeType || file.mimetype || 'application/pdf',
      provider: 'gemini',
    };
  } catch (error: any) {
    console.error('❌ Gemini file upload error:', error.message);
    return { 
      error: `Gemini file upload failed: ${error.message}` 
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FileUploadResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取模型信息用于确定文件大小限制
    const modelParam = req.headers['x-model'] || req.query.model;
    const modelMapping = getModelMapping();
    const modelInfo = modelParam ? modelMapping[modelParam as string] : null;
    
    // 根据提供商设置文件大小限制
    let maxFileSize = 10 * 1024 * 1024; // 默认10MB
    if (modelInfo) {
      console.log('🔍 API Upload Debug - Provider:', modelInfo.provider, 'Type:', typeof modelInfo.provider);
      
      switch (modelInfo.provider) {
        case 'openai':  // LLMProvider.OPENAI = 'openai'
          maxFileSize = 32 * 1024 * 1024; // OpenAI支持32MB
          console.log('✅ 设置OpenAI文件大小限制: 32MB');
          break;
        case 'google':  // LLMProvider.GOOGLE = 'google' (Gemini)
          maxFileSize = 20 * 1024 * 1024; // Gemini内联支持20MB
          console.log('✅ 设置Gemini文件大小限制: 20MB');
          break;
        default:
          maxFileSize = 10 * 1024 * 1024; // 其他10MB
          console.log('⚠️ 使用默认文件大小限制: 10MB for provider:', modelInfo.provider);
      }
    }
    
    console.log('🔍 Final maxFileSize:', maxFileSize, 'MB:', maxFileSize / 1024 / 1024);
    
    // 解析上传的文件，使用动态大小限制
    const form = formidable({ maxFileSize });
    const [fields, files] = await form.parse(req);
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const model = Array.isArray(fields.model) ? fields.model[0] : fields.model;
    const apiKey = Array.isArray(fields.apiKey) ? fields.apiKey[0] : fields.apiKey;
    
    if (!file || !model || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields: file, model, or apiKey' });
    }

    // 验证文件类型
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'text/markdown',
      'text/csv'
    ];

    if (!supportedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({ 
        error: `Unsupported file type: ${file.mimetype}. Supported types: PDF, Word, PowerPoint, Excel, Text files.` 
      });
    }

    // 重新获取模型信息
    const finalModelInfo = modelMapping[model as string];
    if (!finalModelInfo) {
      return res.status(400).json({ error: `Invalid model: ${model}` });
    }

    // 检查模型是否支持文档处理
    if (!finalModelInfo.supports?.documents) {
      return res.status(400).json({ 
        error: `Model ${model} does not support document processing. Please use a model that supports documents.` 
      });
    }

    console.log(`Processing file upload: ${file.originalFilename} (${file.size} bytes) for model ${model}`);

    // 根据提供商上传文件
    let result: FileUploadResult;
    console.log('🔍 Provider for upload:', finalModelInfo.provider);
    
    switch (finalModelInfo.provider) {
      case 'openai':  // LLMProvider.OPENAI = 'openai'
        result = await uploadToOpenAI(file, apiKey);
        break;
        
      case 'google':  // LLMProvider.GOOGLE = 'google' (Gemini)
        result = await uploadToGemini(file, apiKey);
        break;
        
      default:
        result = { error: `Provider ${finalModelInfo.provider} does not support document upload` };
    }

    // 清理临时文件
    if (file.filepath && fs.existsSync(file.filepath)) {
      try {
        fs.unlinkSync(file.filepath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }
    }

    if (result.error) {
      return res.status(400).json(result);
    }

    console.log(`File upload successful: ${file.originalFilename} -> ${result.provider}`);
    return res.status(200).json(result);
    
  } catch (error: any) {
    console.error('File upload error:', error);
    
    // 提供更具体的错误信息
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: `File too large. Maximum size depends on the AI provider: OpenAI (32MB), Gemini (20MB).` 
      });
    }
    
    if (error.code === 'ENOENT') {
      return res.status(400).json({ 
        error: 'File upload failed: File not found or corrupted during upload.' 
      });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Internal server error during file upload' 
    });
  }
} 