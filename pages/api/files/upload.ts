import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { MODEL_MAPPING } from '../../../utils/llmProviders';

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

    // 使用node-fetch而不是axios来处理FormData
    const fetch = require('node-fetch');
    
    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });

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

// Gemini文件上传
async function uploadToGemini(file: formidable.File, apiKey: string): Promise<FileUploadResult> {
  try {
    const fetch = require('node-fetch');
    
    // Gemini使用Files API
    const fileData = fs.readFileSync(file.filepath);
    
    // 初始化上传
    const initResponse = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(fileData.length),
          'X-Goog-Upload-Header-Content-Type': file.mimetype || 'application/pdf',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: {
            display_name: file.originalFilename || 'document.pdf',
          },
        }),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`Gemini init upload error: ${error}`);
    }

    const uploadUrl = initResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw new Error('Failed to get upload URL from Gemini');
    }

    // 上传文件内容
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(fileData.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: fileData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Gemini upload error: ${error}`);
    }

    const result = await uploadResponse.json();
    console.log('Gemini file upload result:', result);

    // 等待文件处理完成
    const fileUri = result.file.uri;
    let fileState = 'PROCESSING';
    let retries = 0;
    const maxRetries = 10;
    
    while (fileState === 'PROCESSING' && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const checkResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileUri}?key=${apiKey}`,
        { method: 'GET' }
      );
      
      if (checkResponse.ok) {
        const fileInfo = await checkResponse.json();
        fileState = fileInfo.state;
        console.log(`Gemini file state: ${fileState}, retry: ${retries}`);
      }
      
      retries++;
    }

    if (fileState !== 'ACTIVE') {
      throw new Error(`Gemini file processing failed. Final state: ${fileState}`);
    }

    return {
      fileUri: fileUri,
      mimeType: result.file.mimeType || file.mimetype || 'application/pdf',
      provider: 'gemini',
    };
  } catch (error: any) {
    console.error('Gemini file upload error:', error.message);
    return { error: error.message };
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
    // 解析上传的文件
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB限制
    const [fields, files] = await form.parse(req);
    
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const model = Array.isArray(fields.model) ? fields.model[0] : fields.model;
    const apiKey = Array.isArray(fields.apiKey) ? fields.apiKey[0] : fields.apiKey;
    
    if (!file || !model || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 获取模型信息
    const modelInfo = MODEL_MAPPING[model as string];
    if (!modelInfo) {
      return res.status(400).json({ error: 'Invalid model' });
    }

    // 根据提供商上传文件
    let result: FileUploadResult;
    switch (modelInfo.provider) {
      case 'gpt':
        if (modelInfo.supports?.documents) {
          result = await uploadToOpenAI(file, apiKey);
        } else {
          result = { error: 'Model does not support document upload' };
        }
        break;
        
      case 'gemini':
        if (modelInfo.supports?.documents) {
          result = await uploadToGemini(file, apiKey);
        } else {
          result = { error: 'Model does not support document upload' };
        }
        break;
        
      default:
        result = { error: `Provider ${modelInfo.provider} does not support document upload` };
    }

    // 清理临时文件
    if (file.filepath) {
      fs.unlinkSync(file.filepath);
    }

    if (result.error) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('File upload error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
} 