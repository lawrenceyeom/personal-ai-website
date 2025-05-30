// utils/fileProcessing.ts
// 增强的文件处理工具 - 基于各家API官方文档优化

import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import Papa from 'papaparse';

// 文件类型定义
export interface ProcessedFile {
  name: string;
  type: string;
  size: number;
  content?: string;
  images?: Array<{
    page: number;
    data: string; // base64
    mimeType: string;
  }>;
  metadata?: {
    pageCount?: number;
    author?: string;
    title?: string;
    creationDate?: Date;
    provider?: string; // 支持的提供商
    processingMethod?: string; // 处理方式
    extractedText?: string; // 提取的文本内容
    worksheetCount?: number; // Excel工作表数量
    slideCount?: number; // PPT幻灯片数量
  };
}

// 处理结果枚举
export enum ProcessingStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed'
}

export interface ProcessingResult {
  status: ProcessingStatus;
  file: ProcessedFile;
  warnings?: string[];
  errors?: string[];
}

// 各提供商的文档支持配置
export const PROVIDER_DOCUMENT_SUPPORT = {
  gemini: {
    pdf: {
      supported: true,
      maxPages: 1000,
      maxSizeInline: 20, // MB
      maxSizeFileAPI: Infinity,
      features: ['text', 'images', 'charts', 'tables', 'layout']
    },
    office: {
      supported: false,
      note: 'Word/PPT/Excel需要先转换为PDF'
    },
    images: {
      supported: true,
      maxSize: 20, // MB
      formats: ['jpeg', 'png', 'webp', 'heic', 'heif']
    }
  },
  openai: {
    pdf: {
      supported: true,
      maxPages: 100,
      maxSize: 32, // MB
      features: ['text', 'images', 'multimodal_extraction']
    },
    office: {
      supported: false,
      note: 'Word/PPT/Excel需要先转换为PDF'
    },
    images: {
      supported: true,
      maxSize: 20, // MB
      formats: ['jpeg', 'png', 'webp', 'gif']
    }
  },
  grok: {
    pdf: {
      supported: false,
      note: '仅支持图像理解，不支持PDF文档'
    },
    office: {
      supported: false,
      note: '不支持任何文档格式'
    },
    images: {
      supported: true,
      maxSize: 5, // MB
      formats: ['jpeg', 'png', 'webp']
    }
  },
  deepseek: {
    pdf: {
      supported: false,
      note: '仅支持文本对话，不支持文档'
    },
    office: {
      supported: false,
      note: '不支持任何文档格式'
    },
    images: {
      supported: false,
      note: '不支持图像处理'
    }
  }
};

// MIME类型映射 - 更全面的支持
const SUPPORTED_DOCUMENT_TYPES = {
  // PDF文档 - Gemini和OpenAI原生支持
  'application/pdf': {
    type: 'pdf',
    name: 'PDF文档',
    supportedProviders: ['gemini', 'openai'],
    processing: 'native'
  },
  
  // Office文档 - 可以提取内容
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'docx',
    name: 'Word文档',
    supportedProviders: [], // 无原生支持，但可以提取内容
    processing: 'content_extraction'
  },
  'application/msword': {
    type: 'doc',
    name: 'Word文档 (旧版)',
    supportedProviders: [],
    processing: 'content_extraction'
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'pptx',
    name: 'PowerPoint演示文稿',
    supportedProviders: [],
    processing: 'content_extraction'
  },
  'application/vnd.ms-powerpoint': {
    type: 'ppt',
    name: 'PowerPoint演示文稿 (旧版)',
    supportedProviders: [],
    processing: 'content_extraction'
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    type: 'xlsx',
    name: 'Excel电子表格',
    supportedProviders: [],
    processing: 'content_extraction'
  },
  'application/vnd.ms-excel': {
    type: 'xls',
    name: 'Excel电子表格 (旧版)',
    supportedProviders: [],
    processing: 'content_extraction'
  },
  
  // 图片文件 - 多模态模型支持
  'image/jpeg': {
    type: 'jpeg',
    name: 'JPEG图片',
    supportedProviders: ['gemini', 'openai', 'grok'],
    processing: 'image'
  },
  'image/png': {
    type: 'png',
    name: 'PNG图片',
    supportedProviders: ['gemini', 'openai', 'grok'],
    processing: 'image'
  },
  'image/webp': {
    type: 'webp',
    name: 'WebP图片',
    supportedProviders: ['gemini', 'openai', 'grok'],
    processing: 'image'
  },
  'image/gif': {
    type: 'gif',
    name: 'GIF图片',
    supportedProviders: ['openai'],
    processing: 'image'
  },
  'image/heic': {
    type: 'heic',
    name: 'HEIC图片',
    supportedProviders: ['gemini'],
    processing: 'image'
  },
  'image/heif': {
    type: 'heif',
    name: 'HEIF图片',
    supportedProviders: ['gemini'],
    processing: 'image'
  },
  
  // 文本文件 - 本地处理
  'text/plain': {
    type: 'txt',
    name: '纯文本',
    supportedProviders: ['all'],
    processing: 'local'
  },
  'text/markdown': {
    type: 'md',
    name: 'Markdown',
    supportedProviders: ['all'],
    processing: 'local'
  },
  'text/csv': {
    type: 'csv',
    name: 'CSV数据',
    supportedProviders: ['all'],
    processing: 'structured_data'
  },
  'application/rtf': {
    type: 'rtf',
    name: 'RTF文档',
    supportedProviders: ['all'],
    processing: 'local'
  }
};

// 检查文件类型支持情况
export function analyzeFileSupport(file: File, provider: string) {
  const mimeType = file.type || 'application/octet-stream';
  const typeInfo = SUPPORTED_DOCUMENT_TYPES[mimeType as keyof typeof SUPPORTED_DOCUMENT_TYPES];
  
  if (!typeInfo) {
    return {
      supported: false,
      reason: `不支持的文件类型: ${mimeType}`,
      recommendation: '请使用PDF、Word、PowerPoint、Excel或文本文件'
    };
  }

  // 提供商名称映射 - 统一到文档支持配置中的键名
  const providerKeyMapping: { [key: string]: string } = {
    'google': 'gemini',    // LLMProvider.GOOGLE -> gemini (for Gemini models)
    'openai': 'openai',    // LLMProvider.OPENAI -> openai
    'anthropic': 'claude', // LLMProvider.ANTHROPIC -> claude (if we add Claude support)
    'xai': 'grok',         // LLMProvider.XAI -> grok
    'deepseek': 'deepseek' // LLMProvider.DEEPSEEK -> deepseek
  };
  
  const mappedProvider = providerKeyMapping[provider] || provider;
  console.log('🔍 Provider mapping:', { original: provider, mapped: mappedProvider });

  // 检查提供商支持
  const providerSupport = PROVIDER_DOCUMENT_SUPPORT[mappedProvider as keyof typeof PROVIDER_DOCUMENT_SUPPORT];
  if (!providerSupport) {
    return {
      supported: false,
      reason: `未知的提供商: ${provider} (mapped: ${mappedProvider})`,
      recommendation: '请检查模型配置'
    };
  }

  // PDF文件特殊检查
  if (typeInfo.type === 'pdf') {
    if (!providerSupport.pdf.supported) {
      return {
        supported: false,
        reason: `${mappedProvider}不支持PDF文档`,
        recommendation: '请切换到Gemini或OpenAI模型'
      };
    }

    // 检查文件大小
    const fileSizeMB = file.size / (1024 * 1024);
    
    // 使用类型保护来处理不同的提供商配置结构
    let maxSize: number;
    let useFileAPI = false;
    
    if (mappedProvider === 'gemini') {
      const geminiSupport = providerSupport.pdf as {
        supported: boolean;
        maxPages: number;
        maxSizeInline: number;
        maxSizeFileAPI: number;
        features: string[];
      };
      maxSize = geminiSupport.maxSizeInline;
      useFileAPI = fileSizeMB > geminiSupport.maxSizeInline && fileSizeMB <= geminiSupport.maxSizeFileAPI;
    } else {
      const otherSupport = providerSupport.pdf as {
        supported: boolean;
        maxPages?: number;
        maxSize?: number;
        features?: string[];
      };
      maxSize = otherSupport.maxSize || 0;
    }
    
    if (fileSizeMB > maxSize) {
      if (mappedProvider === 'gemini' && useFileAPI) {
        return {
          supported: true,
          useFileAPI: true,
          reason: `文件${fileSizeMB.toFixed(1)}MB超过内联限制(${maxSize}MB)，将使用File API`,
          recommendation: '大文件上传可能需要更长时间'
        };
      } else {
        return {
          supported: false,
          reason: `文件${fileSizeMB.toFixed(1)}MB超过${mappedProvider}的限制(${maxSize}MB)`,
          recommendation: `请使用小于${maxSize}MB的文件，或切换到Gemini模型`
        };
      }
    }

    return {
      supported: true,
      useFileAPI: false,
      method: 'native',
      capabilities: mappedProvider === 'gemini' 
        ? (providerSupport.pdf as any).features 
        : (providerSupport.pdf as any).features || []
    };
  }

  // Office文档处理
  if (typeInfo.processing === 'content_extraction') {
    return {
      supported: true,
      method: 'content_extraction',
      reason: `${typeInfo.name}需要提取内容`,
      recommendation: '建议将文档转换为PDF以获得更好的支持',
      limitations: ['仅提取文本内容', '不保留格式', '不处理图表和图片']
    };
  }

  // 文本文件
  if (typeInfo.processing === 'local') {
    return {
      supported: true,
      method: 'local',
      reason: '文本文件将直接读取内容'
    };
  }

  return {
    supported: false,
    reason: '未知的处理方式',
    recommendation: '请联系开发者'
  };
}

// 检查是否支持的文档类型
export function isSupportedDocument(mimeType: string): boolean {
  return mimeType in SUPPORTED_DOCUMENT_TYPES;
}

// 处理文本文件 - 改进版
async function processTextFile(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const content = await file.text();
    
    return {
      status: ProcessingStatus.SUCCESS,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: content,
        metadata: {
          processingMethod: 'direct_text_reading',
          extractedText: content
        }
      },
      warnings
    };
    
  } catch (error: any) {
    errors.push(`文本文件读取失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `文件读取失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
}

// 处理二进制文档 - 大幅改进版
async function processBinaryDocument(file: File, provider?: string): Promise<ProcessingResult> {
  const typeInfo = SUPPORTED_DOCUMENT_TYPES[file.type as keyof typeof SUPPORTED_DOCUMENT_TYPES];
  const supportAnalysis = provider ? analyzeFileSupport(file, provider) : null;
  
  // 根据文件类型选择处理方式
  if (typeInfo?.processing === 'content_extraction') {
    // Office文档 - 进行实际内容提取
    switch (typeInfo.type) {
      case 'docx':
      case 'doc':
        return await processWordDocument(file);
      
      case 'xlsx':
      case 'xls':
        return await processExcelDocument(file);
      
      case 'pptx':
      case 'ppt':
        return await processPowerPointDocument(file);
        
      default:
        // 其他文档类型的通用处理
        return {
          status: ProcessingStatus.PARTIAL,
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            content: `[${file.name}]\n\n暂不支持此文档类型的内容提取。`,
            metadata: {
              processingMethod: 'unsupported_content_extraction'
            }
          },
          warnings: ['文档类型不支持内容提取']
        };
    }
  }
  
  if (typeInfo?.processing === 'image') {
    // 图片文件处理
    return await processImageFile(file);
  }
  
  if (typeInfo?.processing === 'structured_data') {
    // 结构化数据文件（如CSV）
    if (typeInfo.type === 'csv') {
      return await processCSVFile(file);
    }
  }
  
  // 默认处理 - 生成文件描述
  let contentDescription = `[${file.name}]\n\n`;
  contentDescription += `文件类型：${typeInfo?.name || '未知'}\n`;
  contentDescription += `文件大小：${(file.size / 1024).toFixed(2)} KB\n`;
  
  if (supportAnalysis) {
    if (supportAnalysis.supported) {
      if (supportAnalysis.method === 'native') {
        contentDescription += `\n✅ ${provider}原生支持此文档类型\n`;
        if (supportAnalysis.capabilities) {
          contentDescription += `支持功能：${supportAnalysis.capabilities.join(', ')}\n`;
        }
      } else if (supportAnalysis.method === 'content_extraction') {
        contentDescription += `\n⚠️  将尝试提取文本内容\n`;
        if (supportAnalysis.limitations) {
          contentDescription += `限制：${supportAnalysis.limitations.join(', ')}\n`;
        }
      }
      
      if (supportAnalysis.useFileAPI) {
        contentDescription += `\n📤 将使用File API上传大文件\n`;
      }
    } else {
      contentDescription += `\n❌ ${supportAnalysis.reason}\n`;
      if (supportAnalysis.recommendation) {
        contentDescription += `建议：${supportAnalysis.recommendation}\n`;
      }
    }
  }
  
  return {
    status: ProcessingStatus.PARTIAL,
    file: {
    name: file.name,
    type: file.type,
    size: file.size,
      content: contentDescription,
      metadata: {
        provider: provider,
        processingMethod: supportAnalysis?.method || 'description_only'
      }
    },
    warnings: []
  };
}

// 主处理函数 - 完全重写
export async function processDocument(file: File, provider?: string): Promise<ProcessingResult> {
  const mimeType = file.type || 'application/octet-stream';
  
  console.log('🔍 开始处理文件:', {
    name: file.name,
    type: mimeType,
    size: `${(file.size / 1024).toFixed(2)} KB`,
    provider
  });
  
  // 文本文件直接处理
  if (mimeType.startsWith('text/') || mimeType === 'application/rtf') {
    return await processTextFile(file);
  }
  
  // CSV文件特殊处理
  if (mimeType === 'text/csv') {
    return await processCSVFile(file);
  }
  
  // 二进制文档和图片
  return await processBinaryDocument(file, provider);
}

// 格式化文件内容为LLM友好的格式 - 改进版
export function formatFileForLLM(processedFile: ProcessedFile, modelSupportsDocuments: boolean = false): string {
  let formattedContent = `文档：${processedFile.name}\n`;
  
  if (processedFile.metadata) {
    formattedContent += `\n元数据：\n`;
    if (processedFile.metadata.title) formattedContent += `- 标题：${processedFile.metadata.title}\n`;
    if (processedFile.metadata.author) formattedContent += `- 作者：${processedFile.metadata.author}\n`;
    if (processedFile.metadata.pageCount) formattedContent += `- 页数：${processedFile.metadata.pageCount}\n`;
    if (processedFile.metadata.worksheetCount) formattedContent += `- 工作表数：${processedFile.metadata.worksheetCount}\n`;
    if (processedFile.metadata.slideCount) formattedContent += `- 幻灯片数：${processedFile.metadata.slideCount}\n`;
    if (processedFile.metadata.creationDate) formattedContent += `- 创建日期：${processedFile.metadata.creationDate.toLocaleDateString()}\n`;
    if (processedFile.metadata.processingMethod) formattedContent += `- 处理方式：${processedFile.metadata.processingMethod}\n`;
  }
  
  if (processedFile.content) {
    formattedContent += `\n内容：\n${processedFile.content}`;
  }
  
  // 添加图片信息
  if (processedFile.images && processedFile.images.length > 0) {
    formattedContent += `\n\n图片信息：\n`;
    processedFile.images.forEach((img, index) => {
      formattedContent += `- 图片 ${index + 1}: ${img.mimeType}`;
      if (img.page) formattedContent += ` (页面 ${img.page})`;
      formattedContent += '\n';
    });
  }
  
  return formattedContent;
}

// 检查文件大小是否合理 - 根据提供商调整
export function isFileSizeAcceptable(file: File, provider?: string, maxSizeMB: number = 10): boolean {
  console.log('🔍 isFileSizeAcceptable 开始检查:', {
    fileName: file.name,
    fileSize: file.size,
    fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
    provider,
    maxSizeMB,
    fileType: file.type
  });
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  // 基本文件大小检查
  if (file.size > maxSizeBytes) {
    console.log('❌ 基本文件大小检查失败:', file.size, '>', maxSizeBytes);
    return false;
  }
  
  // 如果指定了提供商，进行更详细的检查
  if (provider) {
    // 提供商名称映射
    const providerKeyMapping: { [key: string]: string } = {
      'google': 'gemini',
      'openai': 'openai',
      'anthropic': 'claude',
      'xai': 'grok',
      'deepseek': 'deepseek'
    };
    
    const mappedProvider = providerKeyMapping[provider] || provider;
    console.log('🔍 isFileSizeAcceptable Provider mapping:', { original: provider, mapped: mappedProvider });
    
    const supportAnalysis = analyzeFileSupport(file, provider);
    const providerSupport = PROVIDER_DOCUMENT_SUPPORT[mappedProvider as keyof typeof PROVIDER_DOCUMENT_SUPPORT];
    
    console.log('🔍 提供商检查:', {
      provider,
      mappedProvider,
      supportAnalysis,
      providerSupport: providerSupport?.pdf
    });
    
    // 如果是PDF文档，检查提供商特定的限制
    if (file.type === 'application/pdf' && providerSupport?.pdf?.supported) {
      if (supportAnalysis.useFileAPI) {
        // 使用File API时，文件大小限制更宽松（Gemini特有）
        const geminiSupport = providerSupport.pdf as any;
        const result = file.size <= (geminiSupport.maxSizeFileAPI || Infinity);
        console.log('✅ File API检查:', result, file.size, '<=', geminiSupport.maxSizeFileAPI);
        return result;
      } else {
        // 内联处理时的限制
        if (mappedProvider === 'gemini') {
          const geminiSupport = providerSupport.pdf as any;
          const inlineLimit = geminiSupport.maxSizeInline * 1024 * 1024;
          const result = file.size <= inlineLimit;
          console.log('✅ Gemini内联检查:', result, file.size, '<=', inlineLimit);
          return result;
        } else if (mappedProvider === 'openai') {
          const openaiSupport = providerSupport.pdf as any;
          const maxLimit = openaiSupport.maxSize * 1024 * 1024;
          const result = file.size <= maxLimit;
          console.log('✅ OpenAI检查:', result, file.size, '<=', maxLimit, '(', openaiSupport.maxSize, 'MB)');
          return result;
        }
      }
    }
  }
  
  console.log('✅ 默认检查通过');
  return true;
}

// 获取文件扩展名
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// 获取支持的文件扩展名列表 - 根据提供商
export function getSupportedExtensions(provider?: string): string[] {
  const baseExtensions = ['.txt', '.md', '.csv', '.rtf'];
  
  if (!provider) {
    return [...baseExtensions, '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
  }
  
  const providerSupport = PROVIDER_DOCUMENT_SUPPORT[provider as keyof typeof PROVIDER_DOCUMENT_SUPPORT];
  const extensions = [...baseExtensions];
  
  if (providerSupport?.pdf?.supported) {
    extensions.push('.pdf');
  }
  
  // Office文档总是支持（通过本地提取）
  extensions.push('.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx');
  
  return extensions;
}

// 生成文件上传建议
export function generateUploadRecommendation(file: File, provider: string): string {
  // 提供商名称映射
  const providerKeyMapping: { [key: string]: string } = {
    'google': 'gemini',
    'openai': 'openai',
    'anthropic': 'claude',
    'xai': 'grok',
    'deepseek': 'deepseek'
  };
  
  const mappedProvider = providerKeyMapping[provider] || provider;
  const analysis = analyzeFileSupport(file, provider);
  
  if (analysis.supported) {
    if (analysis.method === 'native') {
      return `✅ ${file.name} 将使用${mappedProvider}的原生文档处理功能`;
    } else if (analysis.method === 'content_extraction') {
      return `⚠️ ${file.name} 将进行文本提取，建议转换为PDF以获得更好支持`;
    } else {
      return `📄 ${file.name} 将直接读取文本内容`;
    }
  } else {
    return `❌ ${analysis.reason} - ${analysis.recommendation}`;
  }
}

// 检查文件格式是否被支持 - 独立于文件大小检查
export function isFileFormatSupported(file: File, provider?: string): { supported: boolean; reason?: string; recommendation?: string } {
  const mimeType = file.type || 'application/octet-stream';
  
  // 基本文件类型检查
  if (!isSupportedDocument(mimeType) && !mimeType.startsWith('text/') && !mimeType.startsWith('image/')) {
    return {
      supported: false,
      reason: '不支持的文件格式',
      recommendation: '请使用PDF、Word、PPT、Excel、文本或图片文件'
    };
  }
  
  // 如果指定了提供商，进行详细分析
  if (provider) {
    const analysis = analyzeFileSupport(file, provider);
    return {
      supported: analysis.supported,
      reason: analysis.reason,
      recommendation: analysis.recommendation
    };
  }
  
  return { supported: true };
}

// Word文档处理 (.docx, .doc)
async function processWordDocument(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // DOCX文件处理
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (result.messages.length > 0) {
        warnings.push(...result.messages.map(msg => `Mammoth: ${msg.message}`));
      }
      
      return {
        status: ProcessingStatus.SUCCESS,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          content: result.value,
          metadata: {
            processingMethod: 'mammoth_text_extraction',
            extractedText: result.value
          }
        },
        warnings
      };
    }
    
    // DOC文件（旧版）暂不支持直接处理
    return {
      status: ProcessingStatus.PARTIAL,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `[${file.name}]\n\n这是一个旧版Word文档(.doc)，建议转换为.docx格式以获得更好的处理效果。`,
        metadata: {
          processingMethod: 'unsupported_format'
        }
      },
      warnings: ['旧版.doc文件无法直接处理，建议转换为.docx格式']
    };
    
  } catch (error: any) {
    errors.push(`Word文档处理失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `文档处理失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
}

// Excel表格处理 (.xlsx, .xls)
async function processExcelDocument(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let content = `[${file.name}] - Excel电子表格\n\n`;
    content += `工作表数量: ${workbook.SheetNames.length}\n\n`;
    
    // 处理每个工作表
    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      content += `## 工作表 ${index + 1}: ${sheetName}\n`;
      
      if (jsonData.length > 0) {
        // 限制显示的行数（避免内容过长）
        const maxRows = 50;
        const displayRows = jsonData.slice(0, maxRows) as any[][];
        
        // 转换为表格文本格式
        displayRows.forEach((row, rowIndex) => {
          if (row && row.length > 0) {
            const rowText = row.map(cell => String(cell || '')).join(' | ');
            content += `${rowIndex + 1}: ${rowText}\n`;
          }
        });
        
        if (jsonData.length > maxRows) {
          content += `... (省略了 ${jsonData.length - maxRows} 行数据)\n`;
          warnings.push(`工作表"${sheetName}"内容过长，仅显示前${maxRows}行`);
        }
      } else {
        content += '(空工作表)\n';
      }
      
      content += '\n';
    });
    
    return {
      status: ProcessingStatus.SUCCESS,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content,
        metadata: {
          processingMethod: 'xlsx_extraction',
          worksheetCount: workbook.SheetNames.length,
          extractedText: content
        }
      },
      warnings
    };
    
  } catch (error: any) {
    errors.push(`Excel文档处理失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `文档处理失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
}

// PowerPoint演示文稿处理 (.pptx, .ppt)
async function processPowerPointDocument(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // PPTX文件处理 - 使用JSZip解析
    if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      let content = `[${file.name}] - PowerPoint演示文稿\n\n`;
      let slideCount = 0;
      let extractedText = '';
      
      // 查找幻灯片文件
      const slideFiles: string[] = [];
      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
          slideFiles.push(relativePath);
        }
      });
      
      slideFiles.sort(); // 确保幻灯片顺序
      slideCount = slideFiles.length;
      
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideXml = await zip.file(slideFile)?.async('text');
        
        if (slideXml) {
          // 简单的XML文本提取（移除XML标签）
          const textContent = slideXml
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (textContent.length > 10) { // 过滤掉过短的内容
            content += `## 幻灯片 ${i + 1}\n${textContent}\n\n`;
            extractedText += textContent + '\n';
          }
        }
      }
      
      if (slideCount === 0) {
        content += '未找到幻灯片内容。\n';
        warnings.push('无法解析幻灯片内容');
      }
      
      return {
        status: slideCount > 0 ? ProcessingStatus.SUCCESS : ProcessingStatus.PARTIAL,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          content,
          metadata: {
            processingMethod: 'pptx_xml_extraction',
            slideCount,
            extractedText
          }
        },
        warnings
      };
    }
    
    // PPT文件（旧版）暂不支持直接处理
    return {
      status: ProcessingStatus.PARTIAL,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `[${file.name}]\n\n这是一个旧版PowerPoint文档(.ppt)，建议转换为.pptx格式以获得更好的处理效果。`,
        metadata: {
          processingMethod: 'unsupported_format'
        }
      },
      warnings: ['旧版.ppt文件无法直接处理，建议转换为.pptx格式']
    };
    
  } catch (error: any) {
    errors.push(`PowerPoint文档处理失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `文档处理失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
}

// 图片文件处理
async function processImageFile(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // 将图片转换为base64格式 - 浏览器兼容版本
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    // 简单的图片信息提取
    const content = `[${file.name}] - 图片文件\n\n` +
                   `文件类型: ${file.type}\n` +
                   `文件大小: ${(file.size / 1024).toFixed(2)} KB\n\n` +
                   `这是一个图片文件，已转换为base64格式供AI模型分析。`;
    
    return {
      status: ProcessingStatus.SUCCESS,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content,
        images: [{
          page: 1,
          data: base64,
          mimeType: file.type
        }],
        metadata: {
          processingMethod: 'image_base64_conversion'
        }
      },
      warnings
    };
    
  } catch (error: any) {
    errors.push(`图片处理失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `图片处理失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
}

// CSV文件处理 - 结构化数据
async function processCSVFile(file: File): Promise<ProcessingResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    const text = await file.text();
    
    return new Promise((resolve) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          const maxRows = 100; // 限制显示行数
          
          let content = `[${file.name}] - CSV数据文件\n\n`;
          content += `总行数: ${data.length}\n`;
          content += `列字段: ${Object.keys(data[0] || {}).join(', ')}\n\n`;
          
          // 显示数据样例
          const displayData = data.slice(0, maxRows);
          displayData.forEach((row, index) => {
            content += `行 ${index + 1}: ${JSON.stringify(row)}\n`;
          });
          
          if (data.length > maxRows) {
            content += `\n... (省略了 ${data.length - maxRows} 行数据)`;
            warnings.push(`CSV文件内容过长，仅显示前${maxRows}行`);
          }
          
          if (results.errors.length > 0) {
            warnings.push(...results.errors.map(err => `CSV解析警告: ${err.message}`));
          }
          
          resolve({
            status: ProcessingStatus.SUCCESS,
            file: {
              name: file.name,
              type: file.type,
              size: file.size,
              content,
              metadata: {
                processingMethod: 'papaparse_csv',
                extractedText: content
              }
            },
            warnings
          });
        },
        error: (error) => {
          errors.push(`CSV解析失败: ${error.message}`);
          resolve({
            status: ProcessingStatus.FAILED,
            file: {
              name: file.name,
              type: file.type,
              size: file.size,
              content: `CSV解析失败: ${error.message}`,
              metadata: {
                processingMethod: 'failed'
              }
            },
            errors
          });
        }
      });
    });
    
  } catch (error: any) {
    errors.push(`CSV文件处理失败: ${error.message}`);
    return {
      status: ProcessingStatus.FAILED,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        content: `文件处理失败: ${error.message}`,
        metadata: {
          processingMethod: 'failed'
        }
      },
      errors
    };
  }
} 