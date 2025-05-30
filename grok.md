# Grok API 官方文档

## 概述

Grok API 是 xAI 提供的人工智能 API 服务，支持聊天对话、图像理解、图像生成、函数调用、结构化输出等多种功能。

## 前置条件

- **xAI 账户**: 需要一个 xAI 账户来访问 API
- **API 密钥**: 确保您的 API 密钥有权限访问相应的端点和模型
- 如果您还没有这些，请参考 [Hitchhiker's Guide to Grok](https://docs.x.ai/docs/quickstart)

### 创建 API 密钥

您可以在 [xAI Console API Keys Page](https://console.x.ai/team/default/api-keys) 创建 API 密钥。

### 设置环境变量

```bash
export XAI_API_KEY="your_api_key"
```

## 1. 聊天对话 (Chat)

聊天是 xAI API 最受欢迎的功能，可用于文章摘要、创意写作、问答、客户支持、编程辅助等各种任务。

### 基础聊天示例

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",
)

completion = client.chat.completions.create(
    model="grok-3-latest",
    messages=[
        {"role": "system", "content": "You are a PhD-level mathematician."},
        {"role": "user", "content": "What is 2 + 2?"},
    ],
)

print(completion.choices[0].message)
```

### 响应格式

```python
ChatCompletionMessage(
    content='2 + 2 equals 4.',
    refusal=None,
    role='assistant',
    audio=None,
    function_call=None,
    tool_calls=None
)
```

### 对话管理

xAI API 是无状态的，不会处理带有先前请求历史上下文的新请求。但是，您可以在新的聊天生成请求中提供先前的聊天提示和结果，让模型在考虑上下文的情况下处理您的新请求。

#### 消息角色

- **system**: 定义模型应如何响应用户请求的指导性内容
- **user**: 通常用于用户请求或发送给模型的数据
- **assistant**: 通常是模型的响应，或作为对话历史的一部分

#### 消息角色顺序灵活性

与其他提供商的某些模型不同，xAI API 的独特之处在于消息角色的灵活性：

- **无顺序限制**: 您可以按任何顺序混合 `system`、`user` 或 `assistant` 角色
- 支持多个系统消息
- 支持用户消息在前

## 2. 推理功能 (Reasoning)

Grok 3 Mini 是一个轻量级的思考模型。与传统模型立即生成答案不同，Grok 3 Mini 在响应之前会进行思考。

### 支持的模型

- `grok-3-mini`
- `grok-3-mini-fast`

注意：`grok-3` 和 `grok-3-fast` 不支持推理功能。

### 关键特性

- **先思考后回答**: 逐步思考问题后再给出答案
- **数学和定量优势**: 在数值挑战和逻辑谜题方面表现出色
- **推理轨迹**: 模型的思考过程可通过响应中的 `reasoning_content` 字段获取

### 推理努力控制

`reasoning_effort` 参数控制模型在响应前的思考时间：

- `low`: 最少思考时间，使用较少令牌快速响应
- `high`: 最大思考时间，为复杂问题使用更多令牌

### 使用示例

```python
import os
from openai import OpenAI

messages = [
    {
        "role": "system",
        "content": "You are a highly intelligent AI assistant.",
    },
    {
        "role": "user",
        "content": "What is 101*3?",
    },
]

client = OpenAI(
    base_url="https://api.x.ai/v1",
    api_key=os.getenv("XAI_API_KEY"),
)

completion = client.chat.completions.create(
    model="grok-3-mini",
    reasoning_effort="high",
    messages=messages,
    temperature=0.7,
)

print("Reasoning Content:")
print(completion.choices[0].message.reasoning_content)

print("\nFinal Response:")
print(completion.choices[0].message.content)

print("\nNumber of completion tokens:")
print(completion.usage.completion_tokens)

print("\nNumber of reasoning tokens:")
print(completion.usage.completion_tokens_details.reasoning_tokens)
```

### 何时使用推理

- **使用 `grok-3-mini` 或 `grok-3-mini-fast`**: 适用于可以从逻辑推理中受益的任务（如会议安排或数学问题）
- **使用 `grok-3` 或 `grok-3-fast`**: 适用于需要深度领域专业知识的查询（如医疗、法律、金融）

## 3. 实时搜索 (Live Search)

实时搜索功能在 2025 年 6 月 5 日之前免费提供（测试版）。

### 启用搜索

通过在聊天完成请求中指定 `search_parameters` 字段来启用搜索：

```python
import os
import requests

url = "https://api.x.ai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('XAI_API_KEY')}"
}
payload = {
    "messages": [
        {
            "role": "user",
            "content": "Provide me a digest of world news in the last 24 hours."
        }
    ],
    "search_parameters": {
        "mode": "auto"
    },
    "model": "grok-3-latest"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

### 搜索模式

- `"off"`: 禁用搜索，仅使用模型而不访问额外数据源
- `"auto"` (默认): 实时搜索可用，但模型自动决定是否执行实时搜索
- `"on"`: 启用实时搜索

### 返回引用

设置 `"return_citations": true` 可在响应中返回数据源引用：

```python
"search_parameters": {
    "mode": "auto",
    "return_citations": True
}
```

### 设置搜索日期范围

使用 `"from_date"` 和 `"to_date"` 限制搜索数据的日期范围（ISO8601 格式）：

```python
"search_parameters": {
    "mode": "auto",
    "from_date": "2022-01-01",
    "to_date": "2022-12-31"
}
```

### 数据源和参数

支持的数据源：

| 数据源 | 描述 | 支持的参数 |
|--------|------|------------|
| `"web"` | 网站搜索 | `"country"`, `"excluded_websites"`, `"safe_search"` |
| `"x"` | X 平台搜索 | `"x_handles"` |
| `"news"` | 新闻源搜索 | `"country"`, `"excluded_websites"`, `"safe_search"` |
| `"rss"` | RSS 订阅源 | `"links"` |

#### 示例：排除特定网站

```python
"sources": [
    { "type": "web", "excluded_websites": ["wikipedia.org"] },
    { "type": "news", "excluded_websites": ["bbc.co.uk"] }
]
```

#### 示例：指定 X 用户

```python
"sources": [{ "type": "x", "x_handles": ["grok"] }]
```

## 4. 流式响应 (Streaming Response)

所有具有文本输出能力的模型都支持流式输出。

### 启用流式响应

在请求中设置 `"stream": true`：

```python
import os
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
)

stream = client.chat.completions.create(
    model="grok-3-latest",
    messages=[
        {"role": "system", "content": "You are Grok, a chatbot inspired by the Hitchhikers Guide to the Galaxy."},
        {"role": "user", "content": "What is the meaning of life, the universe, and everything?"},
    ],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content, end="", flush=True)
```

## 5. 图像理解 (Image Understanding)

视觉模型可以接收文本和图像输入。您可以通过两种方式将图像传递给模型：base64 编码字符串或网络 URL。

### 限制

- **最大图像大小**: 10MiB
- **最大图像数量**: 无限制
- **支持的图像格式**: `jpg/jpeg` 或 `png`
- 接受任何图像/文本输入顺序

### 网络 URL 输入

```python
import os
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
image_url = "https://science.nasa.gov/wp-content/uploads/2023/09/web-first-images-release.png"

client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                    "detail": "high",
                },
            },
            {
                "type": "text",
                "text": "What's in this image?",
            },
        ],
    },
]

completion = client.chat.completions.create(
    model="grok-2-vision-latest",
    messages=messages,
    temperature=0.01,
)

print(completion.choices[0].message.content)
```

### Base64 字符串输入

```python
import os
from openai import OpenAI
import base64

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
    return encoded_string

# 获取 base64 字符串
base64_image = encode_image(image_path)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "high",
                },
            },
            {
                "type": "text",
                "text": "What's in this image?",
            },
        ],
    },
]
```

### 多图像输入

您可以在提示中发送多个图像，图像提示可以与文本提示以任何顺序交错。

### 图像令牌使用

每个图像会自动分解为 448x448 像素的瓦片，每个瓦片消耗 256 个令牌。最终生成会包含一个额外的瓦片，因此每个图像会消耗 `(瓦片数 + 1) * 256` 个令牌。最大限制为 6 个瓦片，因此每个图像最多消耗 1,792 个令牌。

## 6. 图像生成 (Image Generation)

某些模型可以提供图像生成功能。您可以提供想要生成的图像描述，让模型生成一个或多个图片。

### 参数

- `n`: 生成图像数量（1-10，默认为 1）
- `response_format`: `"url"` 或 `"b64_json"`

### 生成图像

```python
import os
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = OpenAI(base_url="https://api.x.ai/v1", api_key=XAI_API_KEY)

response = client.images.generate(
    model="grok-2-image",
    prompt="A cat in a tree"
)

print(response.data[0].url)
```

### Base64 JSON 输出

```python
response = client.images.generate(
    model="grok-2-image",
    prompt="A cat in a tree",
    response_format="b64_json"
)

print(response.data[0].b64_json)
```

### 生成多个图像

```python
response = client.images.generate(
    model="grok-2-image",
    prompt="A cat in a tree",
    n=4
)

for image in response.data:
    print(image.url)
```

### 修订提示

在将提示发送到图像生成模型之前，提示会被聊天模型修订。修订后的提示会在响应的 `revised_prompt` 字段中返回。

```python
print(response.data[0].revised_prompt)
```

## 7. 函数调用 (Function Calling)

函数调用使语言模型能够使用外部工具，将模型与数字和物理世界紧密连接。

### 简介

函数调用是一个强大的功能，可以用于实现广泛的用例：

- 调用公共 API 进行各种操作（查询足球比赛结果、获取实时卫星定位数据等）
- 分析内部数据库
- 浏览网页
- 执行代码
- 与物理世界交互（预订机票、打开特斯拉车门、控制机械臂等）

### 工作流程

函数调用的请求/响应流程如下：

1. **发送初始请求** - 用户发送包含工具定义的消息
2. **模型响应工具调用** - 模型决定调用哪些函数并返回工具调用请求
3. **执行函数并返回结果** - 用户系统执行函数并将结果发送回模型
4. **模型生成最终响应** - 模型基于工具调用结果生成最终回答

### 设置 API 客户端

```python
import os
import json
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")

client = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1",
)
```

### 定义工具函数

#### 使用 Pydantic 定义函数

```python
from pydantic import BaseModel, Field
from typing import Literal

# 定义函数参数
class TemperatureRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")
    unit: Literal["celsius", "fahrenheit"] = Field(
        "fahrenheit", description="Temperature unit"
    )

class CeilingRequest(BaseModel):
    location: str = Field(description="The city and state, e.g. San Francisco, CA")

def get_current_temperature(**kwargs):
    request = TemperatureRequest(**kwargs)
    temperature: int
    if request.unit.lower() == "fahrenheit":
        temperature = 59
    elif request.unit.lower() == "celsius":
        temperature = 15
    else:
        raise ValueError("unit must be one of fahrenheit or celsius")
    return {
        "location": request.location,
        "temperature": temperature,
        "unit": request.unit.lower(),
    }

def get_current_ceiling(**kwargs):
    request = CeilingRequest(**kwargs)
    return {
        "location": request.location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

# 生成 JSON schema
get_current_temperature_schema = TemperatureRequest.model_json_schema()
get_current_ceiling_schema = CeilingRequest.model_json_schema()

# 使用 Pydantic JSON schema 定义参数
tools_definition = [
    {
        "type": "function",
        "function": {
            "name": "get_current_temperature",
            "description": "Get the current temperature in a given location",
            "parameters": get_current_temperature_schema,
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_ceiling",
            "description": "Get the current cloud ceiling in a given location",
            "parameters": get_current_ceiling_schema,
        },
    },
]
```

#### 使用原始字典定义函数

```python
# 定义函数
def get_current_temperature(location: str, unit: str = "fahrenheit"):
    temperature: int
    if unit.lower() == "fahrenheit":
        temperature = 59
    elif unit.lower() == "celsius":
        temperature = 15
    else:
        raise ValueError("unit must be one of fahrenheit or celsius")
    return {"location": location, "temperature": temperature, "unit": unit}

def get_current_ceiling(location: str):
    return {
        "location": location,
        "ceiling": 15000,
        "ceiling_type": "broken",
        "unit": "ft",
    }

tools_map = {
    "get_current_temperature": get_current_temperature,
    "get_current_ceiling": get_current_ceiling,
}

# 原始字典定义参数
tools_definition = [
    {
        "type": "function",
        "function": {
            "name": "get_current_temperature",
            "description": "Get the current temperature in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "default": "fahrenheit"
                    }
                },
                "required": ["location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_ceiling",
            "description": "Get the current cloud ceiling in a given location",
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

### 完整的函数调用流程

#### 1. 发送初始消息

```python
messages = [{"role": "user", "content": "What's the temperature like in San Francisco?"}]
response = client.chat.completions.create(
    model="grok-3-latest",
    messages=messages,
    tools=tools_definition,  # 函数和参数的字典
    tool_choice="auto",
)

# 检查包含工具调用的响应
print(response.choices[0].message)
```

#### 2. 执行工具函数并添加结果到消息

```python
# 将包含工具调用的助手消息添加到消息列表
messages.append(response.choices[0].message)

# 检查响应体中是否有工具调用
if response.choices[0].message.tool_calls:
    for tool_call in response.choices[0].message.tool_calls:
        # 获取 Grok 想要调用的工具函数名称和参数
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)

        # 使用参数调用之前定义的工具函数
        result = tools_map[function_name](**function_args)

        # 将工具函数调用的结果添加到聊天消息历史中
        messages.append(
            {
                "role": "tool",
                "content": json.dumps(result),
                "tool_call_id": tool_call.id  # Grok 响应中提供的 tool_call.id
            }
        )
```

#### 3. 将工具函数结果发送回模型获取响应

```python
response = client.chat.completions.create(
    model="grok-3-latest",
    messages=messages,
    tools=tools_definition,
    tool_choice="auto"
)

print(response.choices[0].message.content)
```

### 函数调用模式

默认情况下，模型会自动决定是否需要函数调用以及选择调用哪些函数（`tool_choice: "auto"`）。

我们提供三种方式来自定义默认行为：

- **强制模型调用函数**: 设置 `tool_choice: "required"`，模型将始终调用函数
- **强制模型调用特定函数**: 设置 `tool_choice: {"type": "function", "function": {"name": "my_function"}}`
- **禁用函数调用**: 不提供工具或设置 `tool_choice: "none"`

## 8. 结构化输出 (Structured Outputs)

结构化输出是一个让 API 以特定、有组织格式（如 JSON 或其他您定义的模式）返回响应的功能。

### 支持的模型

结构化输出支持以下模型：

- `grok-3`
- `grok-3-fast`
- `grok-3-mini`
- `grok-3-mini-fast`
- `grok-2-vision-1212`
- `grok-2-1212`（已弃用）

### 示例：发票解析

结构化输出的常见用例是解析原始文档。例如，发票包含供应商详细信息、金额和日期等结构化数据。

#### 步骤 1：定义模式

```python
from pydantic import BaseModel, Field
from datetime import date
from enum import Enum
from typing import List

class Currency(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"

class LineItem(BaseModel):
    description: str = Field(description="Description of the item or service")
    quantity: int = Field(description="Number of units", ge=1)
    unit_price: float = Field(description="Price per unit", ge=0)

class Address(BaseModel):
    street: str = Field(description="Street address")
    city: str = Field(description="City")
    postal_code: str = Field(description="Postal/ZIP code")
    country: str = Field(description="Country")

class Invoice(BaseModel):
    vendor_name: str = Field(description="Name of the vendor")
    vendor_address: Address = Field(description="Vendor's address")
    invoice_number: str = Field(description="Unique invoice identifier")
    invoice_date: date = Field(description="Date the invoice was issued")
    line_items: List[LineItem] = Field(description="List of purchased items/services")
    total_amount: float = Field(description="Total amount due", ge=0)
    currency: Currency = Field(description="Currency of the invoice")
```

#### 步骤 2：准备提示

**系统提示**：
```text
Given a raw invoice, carefully analyze the text and extract the relevant invoice data into JSON format.
```

**示例发票文本**：
```text
Vendor: Acme Corp, 123 Main St, Springfield, IL 62704
Invoice Number: INV-2025-001
Date: 2025-02-10
Items:
- Widget A, 5 units, $10.00 each
- Widget B, 2 units, $15.00 each
Total: $80.00 USD
```

#### 步骤 3：完整代码

```python
from openai import OpenAI
from pydantic import BaseModel, Field
from datetime import date
from enum import Enum
from typing import List

# Pydantic 模式定义（如上所示）
# ...

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",
)

completion = client.beta.chat.completions.parse(
    model="grok-3",
    messages=[
        {"role": "system", "content": "Given a raw invoice, carefully analyze the text and extract the invoice data into JSON format."},
        {"role": "user", "content": """
            Vendor: Acme Corp, 123 Main St, Springfield, IL 62704
            Invoice Number: INV-2025-001
            Date: 2025-02-10
            Items:
            - Widget A, 5 units, $10.00 each
            - Widget B, 2 units, $15.00 each
            Total: $80.00 USD
        """}
    ],
    response_format=Invoice,
)

invoice = completion.choices[0].message.parsed
print(invoice)
```

#### 步骤 4：类型安全输出

输出将始终是类型安全的并遵循输入模式：

```json
{
  "vendor_name": "Acme Corp",
  "vendor_address": {
    "street": "123 Main St",
    "city": "Springfield",
    "postal_code": "62704",
    "country": "IL"
  },
  "invoice_number": "INV-2025-001",
  "invoice_date": "2025-02-10",
  "line_items": [
    {"description": "Widget A", "quantity": 5, "unit_price": 10.0},
    {"description": "Widget B", "quantity": 2, "unit_price": 15.0}
  ],
  "total_amount": 80.0,
  "currency": "USD"
}
```

## API 端点

- **聊天和图像理解**: `https://api.x.ai/v1/chat/completions`
- **图像生成**: `https://api.x.ai/v1/images/generations`

## 支持的模型

- `grok-3-latest` - 最新的 Grok 3 模型
- `grok-3-fast` - 快速版本的 Grok 3
- `grok-3-mini` - 支持推理的轻量级模型
- `grok-3-mini-fast` - 快速版本的 Grok 3 Mini
- `grok-2-vision-latest` - 图像理解模型
- `grok-2-image` - 图像生成模型

## 模型详细信息

### Grok 3

**擅长企业用例**，如数据提取、编程和文本摘要。在金融、医疗、法律和科学领域拥有深厚的领域知识。

#### 基本信息
- **模型名称**: `grok-3`
- **别名**: `grok-3-latest`
- **服务位置**: us-east-1
- **请求限制**: 10 rps（每秒请求数）

#### 功能特性
- **模态**: 文本输入 → 文本输出
- **上下文窗口**: 131,072 tokens
- **支持功能**:
  - ✅ 函数调用 (Function Calls)
  - ✅ 结构化输出 (Structured Outputs)

#### 定价（快速模式）
- **文本输入**: $3.00 / 百万 tokens
- **文本输出**: $15.00 / 百万 tokens

#### 快速开始

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",
)

completion = client.chat.completions.create(
    model="grok-3",
    messages=[
        {"role": "system", "content": "You are a PhD-level mathematician."},
        {"role": "user", "content": "What is 2 + 2?"},
    ],
)

print(completion.choices[0].message)
```

### Grok 3 Mini

**轻量级思考模型**，在响应前会进行思考。快速、智能，非常适合不需要深度领域知识的逻辑任务。可访问原始思考轨迹。

#### 基本信息
- **模型名称**: `grok-3-mini`
- **别名**: `grok-3-mini-latest`
- **服务位置**: us-east-1
- **请求限制**: 3 rps（每秒请求数）

#### 功能特性
- **模态**: 文本输入 → 文本输出
- **上下文窗口**: 131,072 tokens
- **支持功能**:
  - ✅ 函数调用 (Function Calls)
  - ✅ 结构化输出 (Structured Outputs)
  - ✅ 推理功能 (Reasoning)

#### 定价（快速模式）
- **文本输入**: $0.30 / 百万 tokens
- **文本输出**: $0.50 / 百万 tokens

#### 快速开始

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",
)

completion = client.chat.completions.create(
    model="grok-3-mini",
    messages=[
        {"role": "system", "content": "You are a PhD-level mathematician."},
        {"role": "user", "content": "What is 2 + 2?"},
    ],
)

print(completion.choices[0].message)
```

### Grok 2 Image Gen

**最新的图像生成模型**，可以根据文本提示生成生动、逼真的图像。擅长为营销、社交媒体和娱乐生成图像。

#### 基本信息
- **模型名称**: `grok-2-image-1212`
- **别名**: `grok-2-image`, `grok-2-image-latest`
- **服务位置**: us-east-1
- **请求限制**: 5 rps（每秒请求数）

#### 功能特性
- **模态**: 文本输入 → 图像输出
- **支持功能**:
  - ✅ 图像生成 (Image Generation)

#### 定价
- **图像输出**: $0.07 / 图像

#### 快速开始

```python
import os
from openai import OpenAI

XAI_API_KEY = os.getenv("XAI_API_KEY")
client = OpenAI(base_url="https://api.x.ai/v1", api_key=XAI_API_KEY)

response = client.images.generate(
    model="grok-2-image-1212",
    prompt="A cat in a tree"
)

print(response.data[0].url)
```

#### 示例输出

**提示**: "Draw an epic scene with a snowy alpine and a lake"
- 生成雪山湖泊的史诗场景

**提示**: "Draw a cute puppy in a cafe"
- 生成咖啡厅中可爱小狗的图像

**提示**: "Draw an abstract painting with geometric shapes"
- 生成几何形状的抽象画

### 其他模型

#### Grok 3 Fast
- **模型名称**: `grok-3-fast`
- **特点**: Grok 3 的快速版本，响应速度更快

#### Grok 3 Mini Fast
- **模型名称**: `grok-3-mini-fast`
- **特点**: Grok 3 Mini 的快速版本，推理速度更快

#### Grok 2 Vision
- **模型名称**: `grok-2-vision-latest`
- **特点**: 支持图像理解的视觉模型

## 模型选择指南

### 选择 Grok 3 的场景
- 需要深度领域知识（金融、医疗、法律、科学）
- 企业级数据提取和分析
- 复杂的文本摘要任务
- 高质量的代码生成

### 选择 Grok 3 Mini 的场景
- 逻辑推理任务
- 数学问题解决
- 需要查看思考过程
- 成本敏感的应用
- 不需要深度领域知识的任务

### 选择 Grok 2 Image Gen 的场景
- 营销材料图像生成
- 社交媒体内容创作
- 娱乐和创意项目
- 概念可视化

### 选择快速版本的场景
- 需要低延迟响应
- 实时应用
- 高并发场景

## 更新后的注意事项

1. 推理模型的推理令牌也会计入最终消费量
2. 使用更高的 `reasoning_effort` 设置可能会增加推理令牌消费
3. 实时搜索在 2025 年 6 月 5 日之前免费提供
4. 图像生成不支持流式输出
5. API 与 OpenAI SDK 兼容，但不与 Anthropic SDK 兼容
6. 函数调用支持最多 128 个函数
7. 结构化输出保证响应匹配输入模式
8. 工具调用消息使用 `"role": "tool"`，`"role": "function"` 已弃用 