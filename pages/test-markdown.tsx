import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { preprocessMath } from '../utils/mathProcessor';

const testContent = `
# 测试表格和数学公式

## 表格测试

| 特性 | CAPM | APT |
|--------------------|-----------------------------------|----------------------------------|
| 风险因素 | 单一因素（市场风险，贝塔系数） | 多因素（多个系统性风险因素） |
| 理论基础 | 基于均值-方差分析和市场组合假设 | 基于无套利原则 |
| 假设条件 | 投资者持有市场组合，回报正态分布 | 无需市场组合假设，更加灵活 |
| 风险溢价来源 | 仅来自市场风险 | 来自多个风险因素 |
| 应用场景 | 简单场景，单一市场风险主导 | 复杂场景，多因素影响回报 |

## 数学公式测试

### 基础行内公式
这是一个行内公式：$E(R_i) = R_f + \\beta_i [E(R_m) - R_f]$

### LaTeX显示公式格式测试（AI模型常用格式）
**CAPM核心公式**：
\\[ E(R_i) = R_f + \\beta_i [E(R_m) - R_f] \\]

**APT核心公式**：
\\[ E(R_i) = R_f + \\lambda_1 \\beta_{i1} + \\lambda_2 \\beta_{i2} + \\cdots + \\lambda_k \\beta_{ik} \\]

### LaTeX行内公式格式测试（DeepSeek常用格式）
**变量解释**：
- \\( E(R_i) \\)：资产 \\( i \\) 的预期收益率
- \\( R_f \\)：无风险利率
- \\( \\beta_i \\)：资产 \\( i \\) 的系统性风险（相对于市场）
- \\( E(R_m) \\)：市场组合的预期收益率
- \\( [E(R_m) - R_f] \\)：市场风险溢价

### 方括号格式公式测试（用户提到的格式）
公式：[ E(R_i) = R_f + \\beta_{i,MKT}(R_m - R_f) + \\beta_{i,SMB} \\cdot SMB + \\beta_{i,HML} \\cdot HML ]

另一种格式：[ $E(R_i) = R_f + \\beta_{i,MKT}(R_m - R_f) + \\beta_{i,SMB} \\cdot SMB + \\beta_{i,HML} \\cdot HML$ ]

更多方括号测试：
- [ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} ]
- [ \\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n ]
- [ \\int_0^1 x^2 dx = \\frac{1}{3} ]

### 标准$符号公式
公式：$E(R_i) = R_f + \\beta_{i,MKT}(R_m - R_f) + \\beta_{i,SMB} \\cdot SMB + \\beta_{i,HML} \\cdot HML$

### 块级公式
CAPM模型的公式：

$$E(R_i) = R_f + \\beta_i [E(R_m) - R_f]$$

Fama-French三因子模型：

$$E(R_i) = R_f + \\beta_{i,MKT}(R_m - R_f) + \\beta_{i,SMB} \\cdot SMB + \\beta_{i,HML} \\cdot HML$$

### 复杂公式测试
二次方程的解：

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

矩阵表示：

$$\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}$$

积分公式：

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

### 各种数学符号测试
- 希腊字母：$\\alpha, \\beta, \\gamma, \\delta, \\epsilon, \\theta, \\lambda, \\mu, \\sigma, \\phi, \\psi, \\omega$
- 上下标：$x^2, x_i, x_{i,j}, x^{(n)}, \\beta_{i,MKT}$
- 分数：$\\frac{1}{2}, \\frac{a+b}{c+d}$
- 根号：$\\sqrt{x}, \\sqrt[3]{x}, \\sqrt{x^2 + y^2}$
- 求和：$\\sum_{i=1}^{n} x_i, \\sum_{i=1}^{\\infty} \\frac{1}{i^2}$
- 积分：$\\int_0^1 x dx, \\int_{-\\infty}^{\\infty} e^{-x^2} dx$
- 省略号：$a_1 + a_2 + \\cdots + a_n$

### 混合测试
文本中包含公式：根据CAPM模型，资产的期望收益率为 [ E(R_i) = R_f + \\beta_i (E(R_m) - R_f) ]，其中 $\\beta_i$ 是贝塔系数。

另一个例子：Fama-French三因子模型扩展了CAPM，公式为 [ E(R_i) = R_f + \\beta_{i,MKT}(R_m - R_f) + \\beta_{i,SMB} \\cdot SMB + \\beta_{i,HML} \\cdot HML ]。

LaTeX格式测试：根据模型 \\[ x = \\frac{a + b}{c + d} \\]，我们可以得出结论。

LaTeX行内格式测试：在经济学中，\\( \\beta \\) 系数表示 \\( \\text{Cov}(R_i, R_m) / \\text{Var}(R_m) \\)。

### DeepSeek实际输出格式测试
**CAPM核心公式**：

\\[ E(R_i) = R_f + \\beta_i \\cdot [E(R_m) - R_f] \\]

**变量解释**：
- \\( E(R_i) \\)：资产 \\( i \\) 的预期收益率
- \\( R_f \\)：无风险利率
- \\( \\beta_i \\)：资产 \\( i \\) 的系统性风险（相对于市场）
- \\( E(R_m) \\)：市场组合的预期收益率
- \\( [E(R_m) - R_f] \\)：市场风险溢价

## 代码块测试

\`\`\`python
def calculate_capm(rf, beta, rm):
    """计算CAPM期望收益率"""
    return rf + beta * (rm - rf)

# 示例
risk_free_rate = 0.03
beta = 1.2
market_return = 0.08

expected_return = calculate_capm(risk_free_rate, beta, market_return)
print(f"期望收益率: {expected_return:.2%}")
\`\`\`
`;

export default function TestMarkdown() {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1e2333]/90 border-2 border-[#7dd3fc] rounded-lg p-8">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={{
              // 表格组件
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4">
                  <table {...props} className="min-w-full border-collapse border border-[#233056] bg-[#101624] rounded-lg" />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead {...props} className="bg-[#233056]" />
              ),
              tbody: ({ node, ...props }) => (
                <tbody {...props} />
              ),
              tr: ({ node, ...props }) => (
                <tr {...props} className="border-b border-[#233056] hover:bg-[#1a1f35]/50" />
              ),
              th: ({ node, ...props }) => (
                <th {...props} className="border border-[#233056] px-4 py-2 text-left font-semibold text-[#7dd3fc] bg-[#1e2333]" />
              ),
              td: ({ node, ...props }) => (
                <td {...props} className="border border-[#233056] px-4 py-2 text-gray-300" />
              ),
              pre: ({ node, children, ...props }) => {
                const codeChild = React.Children.toArray(children).find(
                  (child) => React.isValidElement(child) && child.type === 'code'
                ) as React.ReactElement<{ className?: string }> | undefined;
                const codeClassName = codeChild?.props?.className || '';
                const isCodeBlock = /language-(\w+)/.exec(codeClassName);

                if (isCodeBlock) {
                  return (
                    <div className="relative group/code-block my-2 text-base">
                      <pre {...props} className={(props.className || '') + " bg-[#101624] rounded-lg border border-[#233056] p-3 overflow-x-auto"}>
                        {children}
                      </pre>
                    </div>
                  );
                }
                return <pre {...props} className={(props.className || '') + " my-2 whitespace-pre-wrap"}>{children}</pre>;
              },
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                if (inline) {
                  return (
                    <code {...props} className={(className || '') + ' px-1 py-0.5 rounded bg-[#233056] text-[#7dd3fc] text-sm'}>
                      {children}
                    </code>
                  );
                }
                if (match) {
                  return (
                    <code {...props} className={(className || '') + ' text-[#7dd3fc]'}>
                      {children}
                    </code>
                  );
                }
                return <code {...props} className={(className || '') + ' text-base'}>{children}</code>;
              },
              h1: ({node, ...props}) => <h1 className="text-3xl font-bold my-6 text-[#7dd3fc]" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-semibold my-4 text-[#93c5fd]" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-semibold my-3 text-[#60a5fa]" {...props} />,
              p: ({node, ...props}) => <p className="my-3 text-base leading-relaxed" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc list-inside my-3 text-base space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal list-inside my-3 text-base space-y-1" {...props} />,
              li: ({node, ...props}) => <li className="my-1" {...props} />,
            }}
          >
            {preprocessMath(testContent)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
} 