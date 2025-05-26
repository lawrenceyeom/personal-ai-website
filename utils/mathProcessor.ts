// 数学公式预处理工具
// 处理各种数学公式格式，确保正确渲染

/**
 * 预处理数学公式文本，处理各种格式
 * @param content 原始内容
 * @returns 处理后的内容
 */
export function preprocessMath(content: string): string {
  if (!content) return content;

  let processed = content;

  // 首先处理LaTeX显示数学公式格式：\[ formula \]
  // 将 \[ E(R_i) = ... \] 转换为 $$E(R_i) = ...$$
  processed = processed.replace(/\\\[\s*(.*?)\s*\\\]/g, (match, formula) => {
    return `$$${formula.trim()}$$`;
  });

  // 处理LaTeX行内数学公式格式：\( formula \)
  // 将 \( E(R_i) = ... \) 转换为 $E(R_i) = ...$
  processed = processed.replace(/\\\(\s*(.*?)\s*\\\)/g, (match, formula) => {
    return `$${formula.trim()}$`;
  });

  // 然后处理独立的方括号公式格式：[ formula ]
  // 只处理行首或前面有空格/标点的方括号，避免处理LaTeX命令中的方括号
  // 更严格的匹配，确保方括号内包含数学符号
  processed = processed.replace(/(^|[\s\n:：])\[\s*([^[\]]*(?:[=+\-*/^_{}\\]|\\[a-zA-Z]+)[^[\]]*)\s*\]/gm, (match, prefix, formula) => {
    // 如果方括号内已经包含$符号，直接返回
    if (formula.includes('$')) {
      return match;
    }
    // 转换为行内公式
    return `${prefix}$${formula.trim()}$`;
  });

  // 处理双重转义的反斜杠
  processed = processed.replace(/\\\\beta/g, '\\beta');
  processed = processed.replace(/\\\\alpha/g, '\\alpha');
  processed = processed.replace(/\\\\gamma/g, '\\gamma');
  processed = processed.replace(/\\\\delta/g, '\\delta');
  processed = processed.replace(/\\\\epsilon/g, '\\epsilon');
  processed = processed.replace(/\\\\theta/g, '\\theta');
  processed = processed.replace(/\\\\lambda/g, '\\lambda');
  processed = processed.replace(/\\\\mu/g, '\\mu');
  processed = processed.replace(/\\\\sigma/g, '\\sigma');
  processed = processed.replace(/\\\\phi/g, '\\phi');
  processed = processed.replace(/\\\\psi/g, '\\psi');
  processed = processed.replace(/\\\\omega/g, '\\omega');
  processed = processed.replace(/\\\\sum/g, '\\sum');
  processed = processed.replace(/\\\\int/g, '\\int');
  processed = processed.replace(/\\\\frac/g, '\\frac');
  processed = processed.replace(/\\\\sqrt/g, '\\sqrt');
  processed = processed.replace(/\\\\cdot/g, '\\cdot');
  processed = processed.replace(/\\\\cdots/g, '\\cdots');
  processed = processed.replace(/\\\\times/g, '\\times');
  processed = processed.replace(/\\\\pm/g, '\\pm');
  processed = processed.replace(/\\\\infty/g, '\\infty');

  // 处理下标格式，确保正确的LaTeX语法
  processed = processed.replace(/\\_\{([^}]+)\}/g, '_{$1}');
  processed = processed.replace(/\\_([a-zA-Z0-9])/g, '_$1');

  // 处理上标格式
  processed = processed.replace(/\\\^([a-zA-Z0-9()]+)/g, '^{$1}');

  return processed;
}

/**
 * 检查文本是否包含数学公式
 * @param content 文本内容
 * @returns 是否包含数学公式
 */
export function containsMath(content: string): boolean {
  if (!content) return false;
  
  // 检查是否包含常见的数学公式标记
  const mathPatterns = [
    /\$[^$]+\$/,  // 行内公式 $...$
    /\$\$[^$]+\$\$/,  // 块级公式 $$...$$
    /\\\[[^\]]+\\\]/,  // LaTeX显示公式 \[...\]
    /\\\([^)]+\\\)/,  // LaTeX行内公式 \(...\)
    /\\\w+/,  // LaTeX命令
    /\[\s*[^[\]]*[=+\-*/^_{}\\][^[\]]*\s*\]/,  // 方括号包围的公式
  ];
  
  return mathPatterns.some(pattern => pattern.test(content));
}

/**
 * 提取文本中的数学公式
 * @param content 文本内容
 * @returns 数学公式数组
 */
export function extractMathFormulas(content: string): string[] {
  if (!content) return [];
  
  const formulas: string[] = [];
  
  // 提取行内公式
  const inlineMatches = content.match(/\$[^$]+\$/g);
  if (inlineMatches) {
    formulas.push(...inlineMatches);
  }
  
  // 提取块级公式
  const blockMatches = content.match(/\$\$[^$]+\$\$/g);
  if (blockMatches) {
    formulas.push(...blockMatches);
  }
  
  // 提取LaTeX显示公式
  const latexDisplayMatches = content.match(/\\\[[^\]]+\\\]/g);
  if (latexDisplayMatches) {
    formulas.push(...latexDisplayMatches);
  }
  
  // 提取LaTeX行内公式
  const latexInlineMatches = content.match(/\\\([^)]+\\\)/g);
  if (latexInlineMatches) {
    formulas.push(...latexInlineMatches);
  }
  
  // 提取方括号公式
  const bracketMatches = content.match(/\[\s*[^[\]]*[=+\-*/^_{}\\][^[\]]*\s*\]/g);
  if (bracketMatches) {
    formulas.push(...bracketMatches);
  }
  
  return formulas;
} 