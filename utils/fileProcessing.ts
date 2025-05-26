// utils/fileProcessing.ts
// 文件处理工具，支持多种文档格式

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
  };
}

// MIME类型映射
const SUPPORTED_DOCUMENT_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/rtf': 'rtf',
};

// 检查是否支持的文档类型
export function isSupportedDocument(mimeType: string): boolean {
  return mimeType in SUPPORTED_DOCUMENT_TYPES;
}

// 处理文本文件
async function processTextFile(file: File): Promise<ProcessedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        content: content,
      });
    };
    
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 处理二进制文档（PDF、Office等）- 基础实现
async function processBinaryDocument(file: File): Promise<ProcessedFile> {
  // 对于二进制文档，我们提供基础信息
  // 在生产环境中，这些文档应该发送到服务端进行处理
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content: `[${file.name}]\n\n文件类型：${SUPPORTED_DOCUMENT_TYPES[file.type as keyof typeof SUPPORTED_DOCUMENT_TYPES] || '未知'}\n文件大小：${(file.size / 1024).toFixed(2)} KB\n\n注意：对于支持文档处理的AI模型，将直接发送原始文件。对于不支持的模型，可能需要先转换为文本。`,
  };
}

// 主处理函数
export async function processDocument(file: File): Promise<ProcessedFile> {
  const mimeType = file.type || 'application/octet-stream';
  
  // 文本文件直接处理
  if (mimeType.startsWith('text/') || mimeType === 'application/rtf') {
    return processTextFile(file);
  }
  
  // 二进制文档
  return processBinaryDocument(file);
}

// 格式化文件内容为LLM友好的格式
export function formatFileForLLM(processedFile: ProcessedFile, modelSupportsDocuments: boolean = false): string {
  let formattedContent = `文档：${processedFile.name}\n`;
  
  if (processedFile.metadata) {
    formattedContent += `\n元数据：\n`;
    if (processedFile.metadata.title) formattedContent += `- 标题：${processedFile.metadata.title}\n`;
    if (processedFile.metadata.author) formattedContent += `- 作者：${processedFile.metadata.author}\n`;
    if (processedFile.metadata.pageCount) formattedContent += `- 页数：${processedFile.metadata.pageCount}\n`;
    if (processedFile.metadata.creationDate) formattedContent += `- 创建日期：${processedFile.metadata.creationDate.toLocaleDateString()}\n`;
  }
  
  if (processedFile.content) {
    formattedContent += `\n内容：\n${processedFile.content}`;
  }
  
  return formattedContent;
}

// 检查文件大小是否合理
export function isFileSizeAcceptable(file: File, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

// 获取文件扩展名
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// 获取支持的文件扩展名列表
export function getSupportedExtensions(): string[] {
  return [
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', 
    '.xls', '.xlsx', '.txt', '.md', '.csv', '.rtf'
  ];
} 