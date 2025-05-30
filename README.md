# 🤖 AI多模型对话平台

一个功能丰富的Next.js + TypeScript AI聊天应用，支持多个LLM提供商和智能搜索功能。

**当前版本**: v2.2.0 | **状态**: ✅ 生产就绪 | **最后更新**: 2025年1月

## ✨ 主要功能

- 🔀 **多模型支持**: DeepSeek、OpenAI GPT、Claude、Gemini、Grok
- 🔍 **智能搜索**: 集成Google搜索，支持实时信息查询 ⭐ 新增
- 💬 **流式对话**: 实时响应，支持思考过程显示
- 📁 **文件处理**: 支持图片、文档上传和分析（多提供商兼容）
- 💾 **会话管理**: 自动保存，支持归档和批量删除
- ⚙️ **高级设置**: 温度、token限制等参数调节
- 🎨 **现代UI**: 深色主题，响应式设计
- 🏗️ **模块化架构**: 高度可扩展的LLM提供商系统

## 🔍 智能搜索功能 ⭐

### 功能特点
- **实时搜索**: 使用Gemini 2.0 Flash + Google Search工具
- **多模态搜索**: 支持基于图片和文档内容的上下文搜索
- **智能解析**: 自动提取搜索结果的标题、日期、来源、链接
- **内容清理**: 移除搜索模型的前导指令，保留核心信息
- **结果展示**: 结构化显示搜索结果，支持展开/折叠查看
- **无缝集成**: 搜索结果自动合并到对话上下文

### 使用方法
1. 在聊天输入框旁点击🔍搜索按钮启用搜索
2. 输入问题后发送，系统将自动搜索相关信息
3. 查看搜索状态和结果统计（如：找到 3 个搜索结果）
4. 点击"显示搜索结果"查看详细信息和来源链接
5. AI将基于搜索结果给出综合回答

### 配置要求
- 需要配置Gemini API密钥
- 免费层：每天1,500次搜索
- 付费层：$35/1,000次请求

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

```bash
# 克隆项目
git clone [repository-url]
cd personal_ai_website

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### API密钥配置

在应用设置中配置API密钥：

- **DeepSeek**: 获取密钥 → [DeepSeek平台](https://platform.deepseek.com)
- **OpenAI**: 获取密钥 → [OpenAI平台](https://platform.openai.com)
- **Anthropic**: 获取密钥 → [Anthropic Console](https://console.anthropic.com)
- **Google Gemini**: 获取密钥 → [Google AI Studio](https://aistudio.google.com) (搜索功能推荐)
- **xAI (Grok)**: 获取密钥 → [xAI Console](https://console.x.ai)

## 📋 技术栈

- **前端**: Next.js 14, React 18, TypeScript
- **样式**: Tailwind CSS
- **AI集成**: 模块化LLM提供商架构
- **文件处理**: 原生文档API + 本地解析 (多提供商兼容)
- **搜索**: Gemini 2.0 + Google Search (智能解析)
- **存储**: LocalStorage (会话管理)

## 🏗️ 项目结构

```
├── components/           # React组件
│   ├── ChatInput.tsx    # 聊天输入组件 (含搜索按钮)
│   ├── MessageList.tsx  # 消息列表 (含搜索结果显示)
│   └── ...
├── pages/
│   ├── api/
│   │   ├── chat.ts      # 聊天API
│   │   └── search.ts    # 搜索API
│   └── index.tsx        # 主页面 (含搜索逻辑)
├── utils/
│   ├── llm/
│   │   ├── providers/   # LLM提供商模块
│   │   ├── search/      # 智能搜索模块
│   │   └── ...
│   └── ...
├── interfaces/          # TypeScript类型定义
└── PROJECT_DOCUMENTATION.md  # 完整技术文档
```

## 🔧 搜索实现细节

### 展示逻辑
1. **用户发送消息** → 显示原始用户输入
2. **搜索状态** → 显示"🔍 正在搜索相关信息..."
3. **搜索完成** → 显示"✅ 找到 N 个搜索结果"
4. **结果展示** → 结构化显示搜索结果和来源链接
5. **AI思考** → 显示"正在思考中..."动画
6. **AI回复** → 基于搜索结果的综合回答

### 技术架构
- **SearchService**: 封装Gemini搜索API调用
- **智能解析**: 从格式化文本中提取结构化数据
- **结果合并**: 搜索结果智能合并到用户输入中
- **UI分离**: 前端显示与API调用内容分离
- **多模态支持**: 支持基于图片和文档的上下文搜索

## 📊 项目状态

### ✅ 已完成功能 (v2.2.0)
- [x] 多AI模型集成（5个主要提供商）
- [x] 智能搜索功能（Google搜索集成）
- [x] 文件上传兼容性修复
- [x] 模块化架构重构
- [x] 现代化UI界面
- [x] 会话管理系统

### 🔄 下一步计划
- [ ] 用户账户系统
- [ ] API使用量统计
- [ ] 移动端优化
- [ ] 插件系统

### 📈 技术指标
- **代码行数**: ~15,000行
- **性能评分**: 96/100
- **搜索响应**: 1-5秒
- **支持模型**: 20+个

## 🛠️ 开发指南

### 添加新的LLM提供商
1. 在 `utils/llm/providers/` 创建新的提供商类
2. 继承 `BaseLLMProvider` 并实现必要方法
3. 在 `utils/llm/factory.ts` 中注册新提供商
4. 更新 `components/ModelSelector.tsx` 添加UI选项

### 扩展搜索功能
1. 修改 `utils/llm/search/index.ts` 中的搜索逻辑
2. 更新 `pages/api/search.ts` 处理新的搜索参数
3. 在 `components/MessageList.tsx` 中添加新的结果显示

## 📚 文档

- **完整技术文档**: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
- **部署指南**: 见主文档中的部署章节
- **API参考**: 见主文档中的核心文件说明

## 📄 许可证

[MIT License](LICENSE)

## 🤝 贡献

欢迎提交Issue和Pull Request！请参考主文档中的贡献指南。

## 📞 支持

如有问题，请提交Issue或查看完整的故障排除指南。

---

**维护状态**: 积极维护中 | **最后更新**: 2025年1月
