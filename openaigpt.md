# OpenAI API 使用手册简明整理

---

## 目录
- [文本生成与提示](#文本生成与提示)
- [模型选择](#模型选择)
- [提示工程](#提示工程)
- [消息角色与格式](#消息角色与格式)
- [图像与视觉](#图像与视觉)
- [结构化输出（Structured Outputs）](#结构化输出structured-outputs)
- [函数调用（Function Calling）](#函数调用function-calling)
- [会话状态管理](#会话状态管理)
- [推理模型（Reasoning Models）](#推理模型reasoning-models)
- [文件输入（PDF等）](#文件输入pdf等)
- [Web搜索](#web搜索)

---

## 文本生成与提示

- 使用 Responses API 生成文本：

```python
from openai import OpenAI
client = OpenAI()
response = client.responses.create(
    model="gpt-4.1",
    input="Write a one-sentence bedtime story about a unicorn."
)
print(response.output_text)
```

- 响应的 `output` 数组可能包含多种内容（文本、工具调用等），不要假设文本总在 `output[0].content[0].text`。
- SDK 提供 `output_text` 聚合所有文本输出。

---

## 模型选择

- [模型列表](https://platform.openai.com/docs/models)
- Reasoning模型：适合复杂推理、多步规划，但速度慢、价格高。
- GPT模型：速度快、性价比高，需明确指令。
- 大模型适合理解复杂任务，小模型速度快、便宜。
- 推荐默认用 `gpt-4.1`。

### 主要模型详细信息

#### GPT-4.1
**OpenAI旗舰模型，适合复杂任务和跨领域问题解决**

- **上下文窗口**: 1,047,576 tokens
- **最大输出**: 32,768 tokens  
- **知识截止**: 2024年6月1日
- **模态支持**: 文本（输入输出）、图像（仅输入）
- **定价** (每百万tokens):
  - 输入: $2.00
  - 缓存输入: $0.50
  - 输出: $8.00
- **支持功能**: 流式输出、函数调用、结构化输出、微调、蒸馏、预测输出
- **快照版本**: `gpt-4.1`、`gpt-4.1-2025-04-14`

#### o3-mini
**最新小型推理模型，高智能且成本效益好**

- **上下文窗口**: 200,000 tokens
- **最大输出**: 100,000 tokens
- **知识截止**: 2023年10月1日
- **推理token支持**: ✅
- **模态支持**: 仅文本（输入输出）
- **定价** (每百万tokens):
  - 输入: $1.10
  - 缓存输入: $0.55
  - 输出: $4.40
- **支持功能**: 流式输出、函数调用、结构化输出
- **不支持**: 微调、蒸馏、预测输出
- **快照版本**: `o3-mini`、`o3-mini-2025-01-31`

#### GPT-4o
**多模态旗舰模型，高智能且功能全面**

- **上下文窗口**: 128,000 tokens
- **最大输出**: 16,384 tokens
- **知识截止**: 2023年10月1日
- **模态支持**: 文本（输入输出）、图像（仅输入）
- **定价** (每百万tokens):
  - 输入: $2.50
  - 缓存输入: $1.25
  - 输出: $10.00
- **支持功能**: 流式输出、函数调用、结构化输出、微调、蒸馏、预测输出
- **快照版本**: `gpt-4o`、`gpt-4o-2024-08-06`

#### GPT-4o mini Search Preview
**专门用于Web搜索的快速、经济小模型**

- **上下文窗口**: 128,000 tokens
- **最大输出**: 16,384 tokens
- **知识截止**: 2023年10月1日
- **模态支持**: 仅文本（输入输出）
- **定价** (每百万tokens):
  - 输入: $0.15
  - 输出: $0.60
  - **注意**: Web搜索查询需额外按工具调用收费
- **快照版本**: `gpt-4o-mini-search-preview`、`gpt-4o-mini-search-preview-2025-03-11`

### 模型选择建议

| 场景 | 推荐模型 | 理由 |
|------|----------|------|
| 复杂推理、代码生成 | o3-mini | 推理能力强，性价比高 |
| 通用任务、生产环境 | GPT-4.1 | 平衡性能与成本，上下文窗口大 |
| 多模态（文本+图像） | GPT-4o | 支持图像输入，功能全面 |
| Web搜索应用 | GPT-4o mini Search Preview | 专门优化，成本低 |
| 预算有限 | GPT-4o mini | 最便宜，适合简单任务 |

### 通用API端点支持

所有主要模型都支持以下端点：
- Chat Completions (`v1/chat/completions`)
- Responses (`v1/responses`) 
- Realtime (`v1/realtime`)
- Assistants (`v1/assistants`)
- Batch (`v1/batch`)
- 其他音频、图像、审核等端点

---

## 提示工程

- **Prompt Engineering**：编写有效指令，提升输出质量。
- 建议：
  - 固定生产环境模型快照（如 `gpt-4.1-2025-04-14`）。
  - 构建评测（evals）监控提示效果。

### 常用技巧
- 使用 `instructions` 字段高优先级指令。
- 使用消息角色（developer/user/assistant）分层指令。
- Markdown、XML标签可帮助模型理解结构。
- 提供 identity、instructions、examples、context 四大块内容。
- Few-shot learning：在 developer message 中给出多组输入输出示例。
- RAG（检索增强生成）：将外部知识/上下文拼接进 prompt。
- 注意 context window 限制（不同模型支持不同 token 上限）。

---

## 消息角色与格式

- `developer`：开发者指令，优先级最高。
- `user`：用户输入。
- `assistant`：模型输出。
- 推荐用 Markdown 标题/列表、XML 标签分隔不同部分。

**示例：**

```python
response = client.responses.create(
    model="gpt-4.1",
    input=[
        {"role": "developer", "content": "Talk like a pirate."},
        {"role": "user", "content": "Are semicolons optional in JavaScript?"}
    ]
)
```

---

## 图像与视觉

- 支持文本生成图片、图片分析（vision）。
- 主要API：Responses API、Images API、Chat Completions API。
- 最新模型 `gpt-image-1` 支持多模态（文本+图片输入输出）。

**生成图片：**

```python
response = client.responses.create(
    model="gpt-4.1-mini",
    input="Generate an image of gray tabby cat hugging an otter with an orange scarf",
    tools=[{"type": "image_generation"}]
)
# 解析 response.output 获取 base64 图片数据
```

**分析图片：**

- 支持 image_url、base64、file_id 三种方式。
- 可设置 detail（low/high/auto）控制分辨率与token消耗。

**图片输入要求**：PNG/JPEG/WEBP/GIF，≤50MB，无水印/敏感内容。

**计费**：按图片尺寸和 detail 计入 token，详见[官方文档](https://openai.com/api/pricing/)。

---

## 结构化输出（Structured Outputs）

- 让模型输出严格符合 JSON Schema。
- 支持 Pydantic（Python）、Zod（JS）等类型定义。
- 推荐优先用 Structured Outputs，兼容性更好。

**示例：**

```python
from pydantic import BaseModel
class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]
response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[...],
    text_format=CalendarEvent,
)
```

- 支持链式推理、结构化抽取、UI生成、内容审核等场景。
- JSON mode 仅保证输出为合法JSON，不保证结构。
- Schema 须所有字段 required，根节点为 object，最多5层嵌套。
- 支持 streaming（流式）结构化输出。

---

## 函数调用（Function Calling）

- 让模型调用自定义函数/外部API。
- 在 tools 参数中定义函数 schema，模型可自主决定是否调用。
- 支持并行/串行调用、强制调用、严格模式（strict: true）。

**示例：**

```python
tools = [{
    "type": "function",
    "name": "get_weather",
    "description": "Get current temperature for a given location.",
    "parameters": {
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"],
        "additionalProperties": False
    }
}]
response = client.responses.create(
    model="gpt-4.1",
    input=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools
)
```

- 响应 output 中 type=function_call，需解析 arguments 并执行。
- 执行后将结果以 function_call_output 形式追加到 input，再次请求模型生成最终回复。

---

## 会话状态管理

- 多轮对话需手动维护历史消息，或用 `previous_response_id` 串联。
- 每次请求都需带上历史消息，或用 response.id 作为上一轮引用。
- 注意 context window 限制，超长历史需截断。

**示例：**

```python
history = [
    {"role": "user", "content": "tell me a joke"}
]
response = client.responses.create(model="gpt-4o-mini", input=history)
history += [{"role": el.role, "content": el.content} for el in response.output]
history.append({"role": "user", "content": "tell me another"})
second_response = client.responses.create(model="gpt-4o-mini", input=history)
```

---

## 推理模型（Reasoning Models）

- o3、o4-mini等推理模型，适合复杂推理、代码、科学等场景。
- 支持 reasoning.effort（low/medium/high）控制推理深度。
- 推理token不计入上下文，但会计费。
- 推荐预留足够 token 空间（如2.5万）给推理。
- 支持 reasoning.summary 获取推理摘要。
- 推理模型更适合高层指令，GPT模型需更精细指令。

---

## 文件输入（PDF等）

- 支持PDF等文件作为输入，需先上传获取 file_id 或 base64 编码。
- 文件内容会被提取文本+每页图片一并输入模型。
- 单次最多100页/32MB。
- 仅多模态模型支持（如gpt-4o、gpt-4o-mini、o1）。

**示例：**

```python
file = client.files.create(file=open("draconomicon.pdf", "rb"), purpose="user_data")
response = client.responses.create(
    model="gpt-4.1",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_file", "file_id": file.id},
            {"type": "input_text", "text": "What is the first dragon in the book?"}
        ]
    }]
)
```

---

## Web搜索

- 通过 tools 参数添加 web_search_preview 工具，模型可自主决定是否搜索。
- 可指定 user_location、search_context_size（low/medium/high）等参数。
- 响应 output 包含 web_search_call 和 message，message.content[0].annotations 提供引用URL。
- 展示web结果时需明确可点击引用。

**示例：**

```python
response = client.responses.create(
    model="gpt-4.1",
    tools=[{"type": "web_search_preview"}],
    input="What was a positive news story from today?"
)
print(response.output_text)
```

---

## 参考资料
- [OpenAI 官方文档](https://platform.openai.com/docs)
- [OpenAI Cookbook](https://cookbook.openai.com)
- [JSON Schema](https://json-schema.org/)

---

> 本文档为OpenAI API官方手册内容的简明整理，适合开发者快速查阅与实践。 