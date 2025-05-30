# Gemini API 官方手册

## 概述

Gemini API 是 Google 提供的强大的生成式 AI API，支持文本生成、图像生成、多模态输入处理、长上下文处理、结构化输出、思维推理、函数调用、文档理解、图像理解和Google搜索增强等功能。

## 支持的模型

### Gemini 2.5 Pro Preview

我们最先进的思维推理模型，能够处理代码、数学和STEM领域的复杂问题，以及使用长上下文分析大型数据集、代码库和文档。

**模型详情**：
- **模型代码**：`gemini-2.5-pro-preview-05-06`
- **输入类型**：音频、图像、视频、文本
- **输出类型**：文本
- **输入Token限制**：1,048,576
- **输出Token限制**：65,536
- **知识截止**：2025年1月
- **最新更新**：2025年5月

**支持的功能**：
- ✅ 结构化输出
- ✅ 上下文缓存
- ✅ 函数调用
- ✅ 代码执行
- ✅ 搜索增强
- ✅ 思维推理
- ❌ 图像生成
- ❌ 音频生成
- ❌ Live API
- ❌ 微调

### Gemini 2.5 Flash Preview

在价格性能方面表现最佳的模型，提供全面的功能。我们首个支持100万token上下文窗口和思维预算的混合推理模型。

**模型详情**：
- **模型代码**：`models/gemini-2.5-flash-preview-05-20`
- **输入类型**：文本、图像、视频、音频
- **输出类型**：文本
- **输入Token限制**：1,048,576
- **输出Token限制**：65,536
- **知识截止**：2025年1月
- **最新更新**：2025年5月

**支持的功能**：
- ✅ 结构化输出
- ✅ 上下文缓存
- ✅ 函数调用
- ✅ 代码执行
- ✅ 搜索增强
- ✅ 思维推理
- ❌ 图像生成
- ❌ 音频生成
- ❌ 微调

### Gemini 2.0 Flash

提供下一代功能和改进能力，包括卓越的速度、原生工具使用和100万token上下文窗口。为智能体时代而构建的最平衡的多模态模型。

**模型详情**：
- **模型代码**：`models/gemini-2.0-flash`
- **输入类型**：音频、图像、视频、文本
- **输出类型**：文本
- **输入Token限制**：1,048,576
- **输出Token限制**：8,192
- **知识截止**：2024年8月
- **最新更新**：2025年2月

**版本**：
- 最新版：`gemini-2.0-flash`
- 稳定版：`gemini-2.0-flash-001`
- 实验版：`gemini-2.0-flash-exp`

**支持的功能**：
- ✅ 结构化输出
- ✅ 上下文缓存
- ✅ 函数调用
- ✅ 代码执行
- ✅ 搜索增强
- ✅ Live API
- ✅ 思维推理（实验性）
- ❌ 图像生成
- ❌ 音频生成
- ❌ 微调

## 文本生成

### 基础文本生成

Gemini API 可以从各种输入（包括文本、图像、视频和音频）生成文本输出。

```python
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["How does AI work?"]
)
print(response.text)
```

### 系统指令和配置

您可以通过系统指令来指导 Gemini 模型的行为：

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="GEMINI_API_KEY")

response = client.models.generate_content(
    model="gemini-2.0-flash",
    config=types.GenerateContentConfig(
        system_instruction="You are a cat. Your name is Neko."),
    contents="Hello there"
)

print(response.text)
```

### 生成参数配置

可以通过 `GenerateContentConfig` 对象覆盖默认生成参数：

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="GEMINI_API_KEY")

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["Explain how AI works"],
    config=types.GenerateContentConfig(
        max_output_tokens=500,
        temperature=0.1
    )
)
print(response.text)
```

### 多模态输入

Gemini API 支持多模态输入，允许您将文本与媒体文件结合：

```python
from PIL import Image
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")

image = Image.open("/path/to/organ.png")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=[image, "Tell me about this instrument"]
)
print(response.text)
```

### 流式响应

使用流式响应可以在生成过程中增量接收响应：

```python
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")

response = client.models.generate_content_stream(
    model="gemini-2.0-flash",
    contents=["Explain how AI works"]
)
for chunk in response:
    print(chunk.text, end="")
```

### 多轮对话（聊天）

SDK 提供了聊天功能来管理多轮对话：

```python
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")
chat = client.chats.create(model="gemini-2.0-flash")

response = chat.send_message("I have 2 dogs in my house.")
print(response.text)

response = chat.send_message("How many paws are in my house?")
print(response.text)

for message in chat.get_history():
    print(f'role - {message.role}',end=": ")
    print(message.parts[0].text)
```

### 流式聊天

聊天也支持流式响应：

```python
from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")
chat = client.chats.create(model="gemini-2.0-flash")

response = chat.send_message_stream("I have 2 dogs in my house.")
for chunk in response:
    print(chunk.text, end="")

response = chat.send_message_stream("How many paws are in my house?")
for chunk in response:
    print(chunk.text, end="")
```

## 图像生成

Gemini API 支持两种图像生成方式：
1. **Gemini 内置多模态功能** - 适用于大多数用例
2. **Imagen** - Google 专门的图像生成模型，适用于对图像质量要求极高的专业任务

所有生成的图像都包含 SynthID 水印。

### 支持的模型

- **Gemini**: 使用 Gemini 2.0 Flash Preview Image Generation
- **Imagen**: 使用 Imagen 3（仅在付费层可用）

### 使用 Gemini 生成图像

#### 文本到图像生成

```python
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import base64

client = genai.Client()

contents = ('Hi, can you create a 3d rendered image of a pig '
            'with wings and a top hat flying over a happy '
            'futuristic scifi city with lots of greenery?')

response = client.models.generate_content(
    model="gemini-2.0-flash-preview-image-generation",
    contents=contents,
    config=types.GenerateContentConfig(
      response_modalities=['TEXT', 'IMAGE']
    )
)

for part in response.candidates[0].content.parts:
  if part.text is not None:
    print(part.text)
  elif part.inline_data is not None:
    image = Image.open(BytesIO((part.inline_data.data)))
    image.save('gemini-native-image.png')
    image.show()
```

#### 图像编辑（文本和图像到图像）

```python
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
import PIL.Image

image = PIL.Image.open('/path/to/image.png')

client = genai.Client()

text_input = ('Hi, This is a picture of me.'
            'Can you add a llama next to me?',)

response = client.models.generate_content(
    model="gemini-2.0-flash-preview-image-generation",
    contents=[text_input, image],
    config=types.GenerateContentConfig(
      response_modalities=['TEXT', 'IMAGE']
    )
)

for part in response.candidates[0].content.parts:
  if part.text is not None:
    print(part.text)
  elif part.inline_data is not None:
    image = Image.open(BytesIO(part.inline_data.data))
    image.show()
```

### 其他图像生成模式

Gemini 支持多种图像交互模式：

1. **文本到图像和文本（交错）**: 输出图像和相关文本
   - 示例提示："Generate an illustrated recipe for a paella."

2. **图像和文本到图像和文本（交错）**: 使用输入图像和文本创建新的相关图像和文本
   - 示例提示：（上传房间图片）"What other color sofas would work in my space? can you update the image?"

3. **多轮图像编辑（聊天）**: 持续生成/编辑图像
   - 示例提示：[上传蓝色汽车图片] → "Turn this car into a convertible." → "Now change the color to yellow."

### 使用 Imagen 3 生成图像

```python
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

client = genai.Client(api_key='GEMINI_API_KEY')

response = client.models.generate_images(
    model='imagen-3.0-generate-002',
    prompt='Robot holding a red skateboard',
    config=types.GenerateImagesConfig(
        number_of_images= 4,
    )
)
for generated_image in response.generated_images:
  image = Image.open(BytesIO(generated_image.image.image_bytes))
  image.show()
```

### 图像生成限制

- 最佳性能语言：EN, es-MX, ja-JP, zh-CN, hi-IN
- 不支持音频或视频输入
- 图像生成可能不总是触发
- 某些地区/国家不支持图像生成

## 长上下文处理

### 什么是上下文窗口？

上下文窗口类似于短期记忆，是模型一次能处理的信息量限制。Gemini 是首个支持 100 万 token 上下文窗口的模型。

### 100 万 token 的实际意义

- 50,000 行代码（标准 80 字符/行）
- 过去 5 年发送的所有短信
- 8 本平均长度的英文小说
- 超过 200 集平均长度播客的转录

### 长上下文用例

#### 长文本处理

- **大型文本语料库摘要**
- **问答系统**
- **智能体工作流**
- **多样本上下文学习**：使用数百、数千甚至数十万个示例进行学习

#### 长视频处理

- 视频问答
- 视频记忆（如 Google Project Astra）
- 视频字幕生成
- 视频推荐系统
- 视频内容审核
- 实时视频处理

#### 长音频处理

- 实时转录和翻译
- 播客/视频问答
- 会议转录和摘要
- 语音助手

### 长上下文优化

#### 上下文缓存

主要优化策略是使用上下文缓存：
- 按小时付费存储缓存内容
- Gemini Flash 的输入/输出成本比标准成本低约 4 倍
- 适用于"与数据聊天"类应用

### 长上下文限制

- 单个"针"（信息点）检索性能优秀（~99%）
- 多个"针"检索时性能会下降
- 需要在检索准确性和成本之间权衡
- 上下文缓存可以显著降低成本同时保持高性能

## 最佳实践

### 提示技巧

1. **基础文本生成**：零样本提示通常足够
2. **定制输出**：
   - 使用系统指令指导模型
   - 提供少量示例输入输出（少样本提示）
   - 考虑针对高级用例进行微调
3. **参考提示工程指南**获取更多技巧

### 模型选择

- **文本生成**：所有 Gemini 系列模型都支持
- **图像生成**：
  - 大多数用例：选择 Gemini
  - 专业图像质量要求：选择 Imagen
- **长上下文**：查看模型页面了解具体上下文窗口大小

## 注意事项

- 图像生成可能在某些地区不可用
- 使用 `responseModalities: ["TEXT", "IMAGE"]` 配置进行图像生成
- 不支持仅图像输出
- 所有生成的图像都包含 SynthID 水印

## 结构化输出

您可以配置 Gemini 生成结构化输出而不是非结构化文本，允许精确提取和标准化信息以供进一步处理。例如，您可以使用结构化输出从简历中提取信息，标准化它们以构建结构化数据库。

Gemini 可以生成 JSON 或枚举值作为结构化输出。

### 生成 JSON

有两种使用 Gemini API 生成 JSON 的方法：
1. **在模型上配置模式**（推荐）
2. **在文本提示中提供模式**

#### 配置模式（推荐）

要约束模型生成 JSON，请配置 `responseSchema`。模型将以 JSON 格式响应任何提示。

```python
from google import genai
from pydantic import BaseModel

class Recipe(BaseModel):
    recipe_name: str
    ingredients: list[str]

client = genai.Client(api_key="GOOGLE_API_KEY")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="List a few popular cookie recipes, and include the amounts of ingredients.",
    config={
        "response_mime_type": "application/json",
        "response_schema": list[Recipe],
    },
)
# 使用响应作为 JSON 字符串
print(response.text)

# 使用实例化对象
my_recipes: list[Recipe] = response.parsed
```

**注意**：目前尚不支持 Pydantic 验证器。如果发生 `pydantic.ValidationError`，它会被抑制，`.parsed` 可能为空/null。

输出示例：
```json
[
  {
    "recipeName": "Chocolate Chip Cookies",
    "ingredients": [
      "1 cup (2 sticks) unsalted butter, softened",
      "3/4 cup granulated sugar",
      "3/4 cup packed brown sugar",
      "1 teaspoon vanilla extract",
      "2 large eggs",
      "2 1/4 cups all-purpose flour",
      "1 teaspoon baking soda",
      "1 teaspoon salt",
      "2 cups chocolate chips"
    ]
  }
]
```

## Gemini 思维推理

Gemini 2.5 系列模型使用内部"思维过程"，显著提高了它们的推理和多步骤规划能力，使它们在编码、高级数学和数据分析等复杂任务中非常有效。

### 开始之前

确保您使用支持思维推理的 2.5 系列模型。思维推理默认为 2.5 系列模型启用。

### 使用思维推理生成内容

使用思维推理模型发起请求与任何其他内容生成请求类似。关键区别在于在模型字段中指定支持思维推理的模型之一：

```python
from google import genai

client = genai.Client(api_key="GOOGLE_API_KEY")
prompt = "Explain the concept of Occam's Razor and provide a simple, everyday example."
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-05-20",
    contents=prompt
)

print(response.text)
```

### 思维摘要（实验性）

思维摘要提供对模型内部推理过程的洞察。此功能对于验证模型的方法和在较长任务期间保持用户知情很有价值，特别是与流式传输结合使用时。

您可以通过在请求配置中将 `includeThoughts` 设置为 `true` 来启用思维摘要：

#### 非流式思维摘要

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="GOOGLE_API_KEY")
prompt = "What is the sum of the first 50 prime numbers?"
response = client.models.generate_content(
  model="gemini-2.5-flash-preview-05-20",
  contents=prompt,
  config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(
      include_thoughts=True
    )
  )
)

for part in response.candidates[0].content.parts:
  if not part.text:
    continue
  if part.thought:
    print("Thought summary:")
    print(part.text)
    print()
  else:
    print("Answer:")
    print(part.text)
    print()
```

#### 流式思维摘要

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="GOOGLE_API_KEY")

prompt = """
Alice, Bob, and Carol each live in a different house on the same street: red, green, and blue.
The person who lives in the red house owns a cat.
Bob does not live in the green house.
Carol owns a dog.
The green house is to the left of the red house.
Alice does not own a cat.
Who lives in each house, and what pet do they own?
"""

thoughts = ""
answer = ""

for chunk in client.models.generate_content_stream(
    model="gemini-2.5-flash-preview-05-20",
    contents=prompt,
    config=types.GenerateContentConfig(
      thinking_config=types.ThinkingConfig(
        include_thoughts=True
      )
    )
):
  for part in chunk.candidates[0].content.parts:
    if not part.text:
      continue
    elif part.thought:
      if not thoughts:
        print("Thoughts summary:")
      print(part.text)
      thoughts += part.text
    else:
      if not answer:
        print("Answer:")
      print(part.text)
      answer += part.text
```

### 思维预算

`thinkingBudget` 参数让您指导模型在生成响应时可以使用的思维 token 数量。更高的 token 计数通常允许更详细的推理，这对于处理更复杂的任务很有益。

- `thinkingBudget` 必须是 0 到 24576 范围内的整数
- 将思维预算设置为 0 会禁用思维推理
- 根据提示，模型可能会溢出或不足预算

**注意**：`thinkingBudget` 仅在 Gemini 2.5 Flash 中支持。

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash-preview-05-20",
    contents="Provide a list of 3 famous physicists and their key contributions",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_budget=1024)
    ),
)

print(response.text)
```

### 定价

当思维推理开启时，响应定价是输出 token 和思维 token 的总和。您可以从 `thoughtsTokenCount` 字段获取生成的思维 token 总数：

```python
print("Thoughts tokens:",response.usage_metadata.thoughts_token_count)
print("Output tokens:",response.usage_metadata.candidates_token_count)
```

### 支持的模型

| 模型 | 思维摘要 | 思维预算 |
|------|----------|----------|
| Gemini 2.5 Flash | ✔️ | ✔️ |
| Gemini 2.5 Pro | ✔️ | X |

### 最佳实践

#### 调试和引导

- **审查推理**：当您没有从思维推理模型获得预期响应时，仔细分析 Gemini 的推理过程会有所帮助
- **在推理中提供指导**：如果您希望获得特别长的输出，您可能希望在提示中提供指导来约束模型使用的思维量

#### 任务复杂性

- **简单任务**（思维推理可以关闭）：对于不需要复杂推理的直接请求，如事实检索或分类
- **中等任务**（默认/一些思维推理）：许多常见请求受益于一定程度的逐步处理或更深入的理解
- **困难任务**（最大思维推理能力）：对于真正复杂的挑战，模型需要运用其全部推理和规划能力

## 函数调用

函数调用让您将模型连接到外部工具和 API。模型不是生成文本响应，而是理解何时调用特定函数并提供执行现实世界操作所需的参数。

### 函数调用的三个主要用例

1. **增强知识**：从数据库、API 和知识库等外部源访问信息
2. **扩展能力**：使用外部工具执行计算并扩展模型的限制，如使用计算器或创建图表
3. **执行操作**：使用 API 与外部系统交互，如安排约会、创建发票、发送电子邮件或控制智能家居设备

### 基础示例

```python
from google import genai
from google.genai import types

# 为模型定义函数声明
schedule_meeting_function = {
    "name": "schedule_meeting",
    "description": "Schedules a meeting with specified attendees at a given time and date.",
    "parameters": {
        "type": "object",
        "properties": {
            "attendees": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of people attending the meeting.",
            },
            "date": {
                "type": "string",
                "description": "Date of the meeting (e.g., '2024-07-29')",
            },
            "time": {
                "type": "string",
                "description": "Time of the meeting (e.g., '15:00')",
            },
            "topic": {
                "type": "string",
                "description": "The subject or topic of the meeting.",
            },
        },
        "required": ["attendees", "date", "time", "topic"],
    },
}

# 配置客户端和工具
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
tools = types.Tool(function_declarations=[schedule_meeting_function])
config = types.GenerateContentConfig(tools=[tools])

# 发送带有函数声明的请求
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="Schedule a meeting with Bob and Alice for 03/14/2025 at 10:00 AM about the Q3 planning.",
    config=config,
)

# 检查函数调用
if response.candidates[0].content.parts[0].function_call:
    function_call = response.candidates[0].content.parts[0].function_call
    print(f"Function to call: {function_call.name}")
    print(f"Arguments: {function_call.args}")
    # 在真实应用中，您会在这里调用您的函数：
    # result = schedule_meeting(**function_call.args)
else:
    print("No function call found in the response.")
    print(response.text)
```

### 函数调用工作原理

函数调用涉及您的应用程序、模型和外部函数之间的结构化交互：

1. **定义函数声明**：在应用程序代码中定义函数声明
2. **调用带有函数声明的 LLM**：将用户提示与函数声明一起发送给模型
3. **执行函数代码**：模型不执行函数本身，您的应用程序负责处理响应并执行相应的函数
4. **创建用户友好的响应**：如果执行了函数，捕获结果并在后续对话轮次中将其发送回模型

### 完整的函数调用流程示例

#### 步骤 1：定义函数声明

```python
from google.genai import types

# 定义模型可以调用来控制智能灯的函数
set_light_values_declaration = {
    "name": "set_light_values",
    "description": "Sets the brightness and color temperature of a light.",
    "parameters": {
        "type": "object",
        "properties": {
            "brightness": {
                "type": "integer",
                "description": "Light level from 0 to 100. Zero is off and 100 is full brightness",
            },
            "color_temp": {
                "type": "string",
                "enum": ["daylight", "cool", "warm"],
                "description": "Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.",
            },
        },
        "required": ["brightness", "color_temp"],
    },
}

# 这是基于模型建议实际调用的函数
def set_light_values(brightness: int, color_temp: str) -> dict[str, int | str]:
    """Set the brightness and color temperature of a room light. (mock API).

    Args:
        brightness: Light level from 0 to 100. Zero is off and 100 is full brightness
        color_temp: Color temperature of the light fixture, which can be `daylight`, `cool` or `warm`.

    Returns:
        A dictionary containing the set brightness and color temperature.
    """
    return {"brightness": brightness, "colorTemperature": color_temp}
```

#### 步骤 2：调用带有函数声明的模型

```python
from google import genai

# 带有函数声明的生成配置
tools = types.Tool(function_declarations=[set_light_values_declaration])
config = types.GenerateContentConfig(tools=[tools])

# 配置客户端
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 定义用户提示
contents = [
    types.Content(
        role="user", parts=[types.Part(text="Turn the lights down to a romantic level")]
    )
]

# 发送带有函数声明的请求
response = client.models.generate_content(
    model="gemini-2.0-flash", config=config, contents=contents
)

print(response.candidates[0].content.parts[0].function_call)
```

#### 步骤 3：执行函数代码

```python
# 从模型响应中提取工具调用详细信息
tool_call = response.candidates[0].content.parts[0].function_call

if tool_call.name == "set_light_values":
    result = set_light_values(**tool_call.args)
    print(f"Function execution result: {result}")
```

#### 步骤 4：创建用户友好的响应

```python
# 创建函数响应部分
function_response_part = types.Part.from_function_response(
    name=tool_call.name,
    response={"result": result},
)

# 将函数调用和函数执行结果附加到内容
contents.append(types.Content(role="model", parts=[types.Part(function_call=tool_call)]))
contents.append(types.Content(role="user", parts=[function_response_part]))

final_response = client.models.generate_content(
    model="gemini-2.0-flash",
    config=config,
    contents=contents,
)

print(final_response.text)
```

### 并行函数调用

除了单轮函数调用，您还可以一次调用多个函数。当函数彼此不依赖时使用并行函数调用：

```python
power_disco_ball = {
    "name": "power_disco_ball",
    "description": "Powers the spinning disco ball.",
    "parameters": {
        "type": "object",
        "properties": {
            "power": {
                "type": "boolean",
                "description": "Whether to turn the disco ball on or off.",
            }
        },
        "required": ["power"],
    },
}

start_music = {
    "name": "start_music",
    "description": "Play some music matching the specified parameters.",
    "parameters": {
        "type": "object",
        "properties": {
            "energetic": {
                "type": "boolean",
                "description": "Whether the music is energetic or not.",
            },
            "loud": {
                "type": "boolean",
                "description": "Whether the music is loud or not.",
            },
        },
        "required": ["energetic", "loud"],
    },
}

dim_lights = {
    "name": "dim_lights",
    "description": "Dim the lights.",
    "parameters": {
        "type": "object",
        "properties": {
            "brightness": {
                "type": "number",
                "description": "The brightness of the lights, 0.0 is off, 1.0 is full.",
            }
        },
        "required": ["brightness"],
    },
}
```

### 自动函数调用（仅限 Python）

Python SDK 支持自动函数调用功能，它将 Python 函数转换为声明，为您处理函数调用执行和响应循环：

```python
from google import genai
from google.genai import types

# 定义带有类型提示和文档字符串的函数
def get_current_temperature(location: str) -> dict:
    """Gets the current temperature for a given location.

    Args:
        location: The city and state, e.g. San Francisco, CA

    Returns:
        A dictionary containing the temperature and unit.
    """
    # ... (实现) ...
    return {"temperature": 25, "unit": "Celsius"}

# 配置客户端和模型
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
config = types.GenerateContentConfig(
    tools=[get_current_temperature]  # 直接传递函数本身
)

# 发出请求
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="What's the temperature in Boston?",
    config=config,
)

print(response.text)  # SDK 处理函数调用并返回最终文本
```

### 函数调用模式

Gemini API 让您控制模型如何使用提供的工具：

- **AUTO（默认）**：模型根据提示和上下文决定是生成自然语言响应还是建议函数调用
- **ANY**：模型被约束为始终预测函数调用并保证函数模式遵循
- **NONE**：模型被禁止进行函数调用

```python
from google.genai import types

# 配置函数调用模式
tool_config = types.ToolConfig(
    function_calling_config=types.FunctionCallingConfig(
        mode="ANY", allowed_function_names=["get_current_temperature"]
    )
)

# 创建生成配置
config = types.GenerateContentConfig(
    temperature=0,
    tools=[tools],
    tool_config=tool_config,
)
```

### 模型上下文协议（MCP）

模型上下文协议（MCP）是连接 AI 应用程序与外部工具和数据的开放标准。Gemini SDK 内置了对 MCP 的支持：

```python
import os
import asyncio
from datetime import datetime
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 为 stdio 连接创建服务器参数
server_params = StdioServerParameters(
    command="npx",
    args=["-y", "@philschmid/weather-mcp"],
    env=None,
)

async def run():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            prompt = f"What is the weather in London in {datetime.now().strftime('%Y-%m-%d')}?"
            await session.initialize()
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0,
                    tools=[session],
                ),
            )
            print(response.text)

asyncio.run(run())
```

### 支持的模型

| 模型 | 函数调用 | 并行函数调用 | 组合函数调用 |
|------|----------|--------------|--------------|
| Gemini 2.0 Flash | ✔️ | ✔️ | ✔️ |
| Gemini 2.0 Flash-Lite | X | X | X |
| Gemini 1.5 Flash | ✔️ | ✔️ | ✔️ |
| Gemini 1.5 Pro | ✔️ | ✔️ | ✔️ |

### 最佳实践

1. **函数和参数描述**：在描述中要极其清晰和具体
2. **命名**：使用描述性函数名称（不带空格、句点或破折号）
3. **强类型**：为参数使用特定类型以减少错误
4. **工具选择**：提供相关工具，理想情况下保持活动集最多 10-20 个
5. **提示工程**：提供上下文、给出指令、鼓励澄清
6. **温度**：使用低温度（例如 0）以获得更确定和可靠的函数调用
7. **验证**：如果函数调用有重大后果，在执行前与用户验证
8. **错误处理**：在函数中实现强大的错误处理
9. **安全性**：调用外部 API 时注意安全性
10. **Token 限制**：函数描述和参数计入输入 token 限制

## 文档理解

Gemini API 支持 PDF 输入，包括长文档（最多 1000 页）。Gemini 模型使用原生视觉处理 PDF，因此能够理解文档内的文本和图像内容。

### 主要功能

- 分析文档内的图表、图形和表格
- 将信息提取为结构化输出格式
- 回答关于文档中视觉和文本内容的问题
- 文档摘要
- 转录文档内容（如转换为 HTML）并保留布局和格式

### PDF 输入方式

#### 内联数据（小于 20MB）

**从 URL 处理 PDF**：
```python
from google import genai
from google.genai import types
import httpx

client = genai.Client()

doc_url = "https://example.com/document.pdf"
doc_data = httpx.get(doc_url).content

prompt = "Summarize this document"
response = client.models.generate_content(
  model="gemini-2.0-flash",
  contents=[
      types.Part.from_bytes(
        data=doc_data,
        mime_type='application/pdf',
      ),
      prompt])
print(response.text)
```

**本地存储的 PDF**：
```python
import pathlib

filepath = pathlib.Path('document.pdf')
response = client.models.generate_content(
  model="gemini-2.0-flash",
  contents=[
      types.Part.from_bytes(
        data=filepath.read_bytes(),
        mime_type='application/pdf',
      ),
      "Summarize this document"])
```

#### 大型 PDF（使用 File API）

**从 URL 上传大型 PDF**：
```python
import io

doc_io = io.BytesIO(httpx.get(pdf_url).content)

sample_doc = client.files.upload(
  file=doc_io,
  config=dict(mime_type='application/pdf')
)

response = client.models.generate_content(
  model="gemini-2.0-flash",
  contents=[sample_doc, "Summarize this document"])
```

#### 多个 PDF 处理

```python
# 上传多个 PDF
sample_pdf_1 = client.files.upload(file=doc_data_1, config=dict(mime_type='application/pdf'))
sample_pdf_2 = client.files.upload(file=doc_data_2, config=dict(mime_type='application/pdf'))

response = client.models.generate_content(
  model="gemini-2.0-flash",
  contents=[sample_pdf_1, sample_pdf_2, "Compare these two documents"])
```

### 技术细节

- **页数限制**：最多 1000 页
- **支持格式**：PDF、JavaScript、Python、TXT、HTML、CSS、Markdown、CSV、XML、RTF
- **Token 计算**：每页相当于 258 个 token
- **图像处理**：大页面缩放至 3072x3072，小页面放大至 768x768
- **最佳实践**：上传前旋转页面至正确方向，避免模糊页面

## 图像理解

Gemini 模型可以处理图像，支持多种前沿的开发用例。主要视觉能力包括：

- 图像标题和问答
- 转录和推理 PDF（最多 200 万 token）
- 检测图像中的对象并返回边界框坐标
- 分割图像中的对象

### 图像输入方式

#### 上传图像文件

```python
from google import genai

client = genai.Client(api_key="GOOGLE_API_KEY")

my_file = client.files.upload(file="path/to/sample.jpg")

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=[my_file, "Caption this image."],
)
print(response.text)
```

#### 内联图像数据

**本地图像文件**：
```python
from google.genai import types

with open('path/to/image.jpg', 'rb') as f:
    image_bytes = f.read()

response = client.models.generate_content(
  model='gemini-2.0-flash',
  contents=[
    types.Part.from_bytes(
      data=image_bytes,
      mime_type='image/jpeg',
    ),
    'Caption this image.'
  ]
)
```

**从 URL 获取图像**：
```python
import requests

image_path = "https://example.com/image.jpg"
image_bytes = requests.get(image_path).content
image = types.Part.from_bytes(
  data=image_bytes, mime_type="image/jpeg"
)

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["What is this image?", image],
)
```

#### 多图像提示

```python
# 混合使用上传文件和内联数据
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=[
        "What is different between these two images?",
        uploaded_file,  # 上传的文件引用
        types.Part.from_bytes(data=img2_bytes, mime_type='image/png')  # 内联数据
    ]
)
```

### 对象检测和边界框

```python
prompt = "Detect all prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."
```

**坐标标准化**：
1. 将每个输出坐标除以 1000
2. 将 x 坐标乘以原始图像宽度
3. 将 y 坐标乘以原始图像高度

### 图像分割（Gemini 2.5+）

```python
prompt = """
Give the segmentation masks for the wooden and glass items.
Output a JSON list of segmentation masks where each entry contains the 2D
bounding box in the key "box_2d", the segmentation mask in key "mask", and
the text label in the key "label". Use descriptive labels.
"""
```

### 支持的图像格式

- PNG (image/png)
- JPEG (image/jpeg)
- WEBP (image/webp)
- HEIC (image/heic)
- HEIF (image/heif)

### 技术细节

- **文件限制**：每个请求最多 3,600 个图像文件
- **Token 计算**：
  - 小图像（≤384px）：258 token
  - 大图像：按 768x768 瓦片计算，每瓦片 258 token
- **最佳实践**：确保图像正确旋转，使用清晰图像，文本提示放在图像后面

## Google 搜索增强

Google 搜索增强功能可以提高模型响应的准确性和时效性。启用后，Gemini API 会返回基础来源（内联支持链接）和 Google 搜索建议。

### 配置搜索增强（Gemini 2.0+）

```python
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch

client = genai.Client()

google_search_tool = Tool(google_search=GoogleSearch())

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents="When is the next total solar eclipse in the United States?",
    config=GenerateContentConfig(
        tools=[google_search_tool],
        response_modalities=["TEXT"],
    )
)

# 获取响应文本
for part in response.candidates[0].content.parts:
    print(part.text)

# 获取基础元数据
print(response.candidates[0].grounding_metadata.search_entry_point.rendered_content)
```

### 主要用例

- **增强事实性和时效性**：提供更准确的答案
- **检索网络内容**：进行进一步分析
- **查找相关媒体**：协助多模态推理或生成任务
- **编码和技术故障排除**：专业任务支持
- **区域特定信息**：准确翻译内容
- **查找相关网站**：进一步浏览

### Google 搜索检索（Gemini 1.5 兼容）

```python
from google.genai import types

response = client.models.generate_content(
    model='gemini-1.5-flash',
    contents="Who won the US open this year?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(
            google_search_retrieval=types.GoogleSearchRetrieval()
        )]
    )
)
```

#### 动态阈值控制

```python
response = client.models.generate_content(
    model='gemini-1.5-flash',
    contents="Who won Roland Garros this year?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(
            google_search_retrieval=types.GoogleSearchRetrieval(
                dynamic_retrieval_config=types.DynamicRetrievalConfig(
                    mode=types.DynamicRetrievalConfigMode.MODE_DYNAMIC,
                    dynamic_threshold=0.6))
        )]
    )
)
```

### 动态检索工作原理

- **预测分数**：Gemini 为提示分配 0-1 范围的预测分数
- **阈值**：可配置的浮点值（0-1，默认 0.3）
- **触发条件**：预测分数 ≥ 阈值时使用 Google 搜索

**示例预测分数**：
- "Write a poem about peonies" → 0.13（低分，无需搜索）
- "Who won the latest F1 grand prix?" → 0.97（高分，需要搜索）

### 基础响应结构

成功的基础响应包含 `groundingMetadata`，其中包括：
- **搜索入口点**：Google 搜索建议的渲染内容
- **基础块**：用于生成响应的网络来源
- **基础支持**：文本段落与来源的置信度分数
- **网络搜索查询**：执行的搜索查询

### 定价和限制

- **免费层**：每天 1,500 次 Google 搜索增强查询
- **付费层**：额外查询按每 1,000 次查询 $35 计费
- **URI 访问**：基础 URI 在生成后 30 天内可访问
- **重要提示**：提供的 URI 必须由最终用户直接访问，不得通过自动化方式查询

## 注意事项

- 图像生成可能在某些地区不可用
- 使用 `responseModalities: ["TEXT", "IMAGE"]` 配置进行图像生成
- 不支持仅图像输出
- 所有生成的图像都包含 SynthID 水印
- PDF 处理最多支持 1000 页
- 图像处理每个请求最多 3,600 个文件
- Google 搜索增强需要显示搜索建议
- 基础 URI 不得用于自动化访问 

## 定价信息

### Gemini 2.5 Flash Preview

| 功能 | 免费层 | 付费层（每100万token，美元） |
|------|--------|------------------------------|
| **输入价格** | 免费 | $0.15（文本/图像/视频）<br>$1.00（音频） |
| **输出价格** | 免费 | 非思维：$0.60<br>思维：$3.50 |
| **上下文缓存** | 不可用 | $0.0375（文本/图像/视频）<br>$0.25（音频）<br>$1.00/100万token/小时 |
| **Google搜索增强** | 免费，最多500 RPD | 1,500 RPD（免费），然后$35/1,000请求 |
| **文本转语音** | 免费 | 输入：$0.50<br>输出：$10.00 |
| **用于改进产品** | 是 | 否 |

### Gemini 2.5 Pro Preview

| 功能 | 免费层 | 付费层（每100万token，美元） |
|------|--------|------------------------------|
| **输入价格** | 不可用 | ≤200k token：$1.25<br>>200k token：$2.50 |
| **输出价格**（含思维token） | 不可用 | ≤200k token：$10.00<br>>200k token：$15.00 |
| **上下文缓存** | 不可用 | ≤200k token：$0.31<br>>200k token：$0.625<br>$4.50/100万token/小时 |
| **Google搜索增强** | 不可用 | 1,500 RPD（免费），然后$35/1,000请求 |
| **文本转语音** | 免费 | 输入：$1.00<br>输出：$20.00 |
| **用于改进产品** | 是 | 否 |

### Gemini 2.0 Flash

| 功能 | 免费层 | 付费层（每100万token，美元） |
|------|--------|------------------------------|
| **输入价格** | 免费 | $0.10（文本/图像/视频）<br>$0.70（音频） |
| **输出价格** | 免费 | $0.40 |
| **上下文缓存** | 免费 | $0.025/100万token（文本/图像/视频）<br>$0.175/100万token（音频） |
| **上下文缓存存储** | 免费，最多100万token/小时 | $1.00/100万token/小时 |
| **图像生成** | 免费 | $0.039/图像* |
| **Google搜索增强** | 免费，最多500 RPD | 1,500 RPD（免费），然后$35/1,000请求 |
| **Live API** | 免费 | 输入：$0.35（文本），$2.10（音频/图像/视频）<br>输出：$1.50（文本），$8.50（音频） |
| **用于改进产品** | 是 | 否 |

*图像输出按每100万token $30计费。最大1024x1024px的输出图像消耗1290 token，相当于每图像$0.039。

### 免费层与付费层对比

**免费层特点**：
- 较低的速率限制
- 用于测试目的
- Google AI Studio完全免费
- 数据可能用于改进产品

**付费层特点**：
- 更高的速率限制
- 额外功能
- 不同的数据处理政策
- 数据不用于改进产品

**注意事项**：
- 预览模型在变为稳定版之前可能会发生变化
- 预览模型具有更严格的速率限制
- RPD = Requests Per Day（每日请求数） 