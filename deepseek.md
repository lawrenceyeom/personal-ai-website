# DeepSeek API 官方手册

## 概述

DeepSeek API 提供了强大的对话补全功能，支持多种模型和高级功能。本文档详细介绍了API的使用方法、参数配置和最佳实践。

## 对话补全 API

### 基本信息

- **端点**: `POST https://api.deepseek.com/chat/completions`
- **功能**: 根据输入的上下文，让模型补全对话内容
- **内容类型**: `application/json`

### 请求参数

#### 必需参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `messages` | `object[]` | 对话的消息列表（至少1条） |
| `model` | `string` | 使用的模型ID（`deepseek-chat` 或 `deepseek-reasoner`） |

#### 消息格式

支持四种消息类型：

1. **System message**
   ```json
   {
     "role": "system",
     "content": "system消息的内容",
     "name": "可选的参与者名称"
   }
   ```

2. **User message**
   ```json
   {
     "role": "user", 
     "content": "用户消息内容"
   }
   ```

3. **Assistant message**
   ```json
   {
     "role": "assistant",
     "content": "助手回复内容"
   }
   ```

4. **Tool message**
   ```json
   {
     "role": "tool",
     "content": "工具调用结果"
   }
   ```

#### 可选参数

| 参数 | 类型 | 范围 | 默认值 | 描述 |
|------|------|------|--------|------|
| `frequency_penalty` | `number` | -2.0 ~ 2.0 | 0 | 频率惩罚，降低重复内容 |
| `max_tokens` | `integer` | 1 ~ 8192 | 4096 | 最大输出token数 |
| `presence_penalty` | `number` | -2.0 ~ 2.0 | 0 | 存在惩罚，增加新话题可能性 |
| `temperature` | `number` | 0 ~ 2 | 1 | 采样温度，控制随机性 |
| `top_p` | `number` | 0 ~ 1 | 1 | 核采样参数 |
| `stream` | `boolean` | - | false | 是否流式输出 |
| `stop` | `string/array` | - | null | 停止词 |

#### 高级参数

- **response_format**: 指定输出格式
  ```json
  {
    "type": "json_object"  // 启用JSON模式
  }
  ```

- **tools**: 工具调用配置（最多128个函数）
- **tool_choice**: 控制工具调用行为（`none`/`auto`/`required`）
- **logprobs**: 是否返回对数概率
- **top_logprobs**: 返回top N概率的token（0-20）

### 响应格式

#### 标准响应

```json
{
  "id": "对话唯一标识符",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "模型回复内容"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150,
    "prompt_cache_hit_tokens": 80,
    "prompt_cache_miss_tokens": 20
  }
}
```

## 推理模型 (deepseek-reasoner)

### 特性

- 在输出最终答案前先输出思维链内容
- 提供推理过程的透明度
- 支持思维链内容的查看、展示和蒸馏

### 特殊参数

- **max_tokens**: 默认32K，最大64K（包含思维链输出）
- **reasoning_content**: 思维链内容输出字段

### 支持功能

- ✅ Function Calling
- ✅ JSON Output  
- ✅ 对话补全
- ✅ 对话前缀续写 (Beta)
- ❌ FIM 补全 (Beta)

### 不支持参数

- `temperature`、`top_p`、`presence_penalty`、`frequency_penalty`（设置不报错但不生效）
- `logprobs`、`top_logprobs`（设置会报错）

### 上下文拼接规则

⚠️ **重要**: 思维链内容不会被拼接到下一轮对话的上下文中，只有最终回答会被保留。

## 代码示例

### Python SDK 示例

```python
from openai import OpenAI

# 初始化客户端
client = OpenAI(
    api_key="<your API key>", 
    base_url="https://api.deepseek.com"
)

# 基本对话
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Hello"},
    ],
    max_tokens=1024,
    temperature=0.7,
    stream=False
)

print(response.choices[0].message.content)
```

### 推理模型示例

```python
# 非流式
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages
)

reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content

# 流式
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages,
    stream=True
)

reasoning_content = ""
content = ""

for chunk in response:
    if chunk.choices[0].delta.reasoning_content:
        reasoning_content += chunk.choices[0].delta.reasoning_content
    else:
        content += chunk.choices[0].delta.content
```

### HTTP 请求示例

```python
import requests
import json

url = "https://api.deepseek.com/chat/completions"

payload = {
    "messages": [
        {"content": "You are a helpful assistant", "role": "system"},
        {"content": "Hi", "role": "user"}
    ],
    "model": "deepseek-chat",
    "max_tokens": 2048,
    "temperature": 1,
    "stream": False
}

headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Bearer <TOKEN>'
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.text)
```

## 多轮对话

DeepSeek API 是无状态的，需要手动管理对话历史：

```python
# 第一轮
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(model="deepseek-chat", messages=messages)

# 添加模型回复到历史
messages.append(response.choices[0].message)

# 第二轮
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(model="deepseek-chat", messages=messages)
```

## JSON Output

### 使用方法

1. 设置 `response_format` 为 `{'type': 'json_object'}`
2. 在prompt中包含"json"关键词和格式示例
3. 合理设置 `max_tokens` 防止截断

### 示例代码

```python
system_prompt = """
The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format. 

EXAMPLE INPUT: 
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}
"""

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Which is the longest river in the world? The Nile River."}
    ],
    response_format={'type': 'json_object'}
)
```

## Function Calling

### 工具定义

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of an location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    }
                },
                "required": ["location"]
            }
        }
    }
]
```

### 完整流程

```python
def send_messages(messages):
    return client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        tools=tools
    ).choices[0].message

# 1. 用户询问
messages = [{"role": "user", "content": "How's the weather in Hangzhou?"}]
message = send_messages(messages)

# 2. 模型返回工具调用
tool = message.tool_calls[0]
messages.append(message)

# 3. 执行工具并返回结果
messages.append({
    "role": "tool", 
    "tool_call_id": tool.id, 
    "content": "24℃"
})

# 4. 模型生成最终回复
message = send_messages(messages)
print(message.content)
```

## 模型与价格

### 模型对比

| 特性 | deepseek-chat | deepseek-reasoner |
|------|---------------|-------------------|
| 上下文长度 | 64K | 64K |
| 输出长度 | 默认4K，最大8K | 默认32K，最大64K |
| JSON Output | ✅ | ✅ |
| Function Calling | ✅ | ✅ |
| 对话前缀续写 | ✅ | ✅ |
| FIM 补全 | ✅ | ❌ |

### 价格表（百万tokens）

#### 标准时段（北京时间 08:30-00:30）

| 计费项 | deepseek-chat | deepseek-reasoner |
|--------|---------------|-------------------|
| 输入（缓存命中） | 0.5元 | 1元 |
| 输入（缓存未命中） | 2元 | 4元 |
| 输出 | 8元 | 16元 |

#### 优惠时段（北京时间 00:30-08:30）

| 计费项 | deepseek-chat | deepseek-reasoner |
|--------|---------------|-------------------|
| 输入（缓存命中） | 0.25元（5折） | 0.25元（2.5折） |
| 输入（缓存未命中） | 1元（5折） | 1元（2.5折） |
| 输出 | 4元（5折） | 4元（2.5折） |

### 扣费规则

- 扣减费用 = token消耗量 × 模型单价
- 优先扣减赠送余额，再扣减充值余额
- 计价时间为请求完成时间

## 注意事项

1. **推理模型**: `reasoning_content` 不计入上下文长度，但不能在输入中包含此字段
2. **JSON模式**: 必须在prompt中包含"json"关键词和示例
3. **工具调用**: 最多支持128个函数
4. **上下文缓存**: 可显著降低重复内容的计费成本
5. **价格变动**: DeepSeek保留修改价格的权利，请定期查看最新信息

## 升级说明

使用 `deepseek-reasoner` 前请升级 OpenAI SDK：

```bash
pip3 install -U openai
```

---

*本文档基于DeepSeek官方API手册整理，如有更新请以官方文档为准。* 