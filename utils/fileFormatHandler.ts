// 文件格式处理工具函数
import { UploadedFile } from '../components/ChatInput';

/**
 * 根据LLM提供商构建正确的文件引用格式
 * @param provider - LLM提供商名称
 * @param files - 已上传的文件列表
 * @param textContent - 文本内容
 * @returns 构建好的消息内容
 */
export function buildFileMessageContent(
  provider: string,
  files: UploadedFile[],
  textContent: string
): any {
  // 分离原生文档文件
  const nativeDocFiles = files.filter(f => f.fileId || f.fileUri);
  
  if (nativeDocFiles.length === 0) {
    return textContent;
  }

  switch (provider.toLowerCase()) {
    case 'openai':
    case 'gpt': {
      // OpenAI格式: 使用file类型和file_id
      const fileRefs = nativeDocFiles
        .filter(f => f.fileId)
        .map(file => ({
          type: 'file',
          file: {
            file_id: file.fileId
          }
        }));

      if (fileRefs.length > 0) {
        return [
          { type: 'text', text: textContent },
          ...fileRefs
        ];
      }
      break;
    }

    case 'google':
    case 'gemini': {
      // Gemini格式: 使用fileData和fileUri
      const fileRefs = nativeDocFiles
        .filter(f => f.fileUri)
        .map(file => ({
          fileData: {
            mimeType: file.type || 'application/pdf',
            fileUri: file.fileUri
          }
        }));

      if (fileRefs.length > 0) {
        return [
          { type: 'text', text: textContent },
          ...fileRefs
        ];
      }
      break;
    }

    default:
      // 其他提供商: 在文本中引用
      let additionalContent = '\n\n--- 已上传文档 ---\n';
      nativeDocFiles.forEach(file => {
        if (file.fileId) {
          additionalContent += `[文件: ${file.name}, ID: ${file.fileId}]\n`;
        } else if (file.fileUri) {
          additionalContent += `[文件: ${file.name}, URI: ${file.fileUri}]\n`;
        }
      });
      return textContent + additionalContent;
  }

  return textContent;
}

/**
 * 验证文件引用是否完整
 * @param provider - LLM提供商名称
 * @param files - 文件列表
 * @returns 验证结果
 */
export function validateFileReferences(
  provider: string,
  files: UploadedFile[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  files.forEach(file => {
    if (provider.toLowerCase() === 'openai' || provider.toLowerCase() === 'gpt') {
      if (!file.fileId && !file.content?.includes('本地处理')) {
        missing.push(`${file.name}: 缺少OpenAI file_id`);
      }
    } else if (provider.toLowerCase() === 'google' || provider.toLowerCase() === 'gemini') {
      if (!file.fileUri && !file.content?.includes('本地处理')) {
        missing.push(`${file.name}: 缺少Gemini fileUri`);
      }
    }
  });

  return {
    valid: missing.length === 0,
    missing
  };
} 