# 🚀 Personal AI Website - Render 部署指南

## 📋 部署前检查清单

### ✅ 已完成的优化
- [x] **知识截断点显示** - 在模型能力描述右侧显示知识截断时间
- [x] **默认模型调整** - GPT-4.1 作为 OpenAI 默认，Grok-3-latest 作为 XAI 默认
- [x] **用户菜单层级修复** - 使用 React Portal 解决遮挡问题
- [x] **文件处理系统** - 支持 Word、Excel、PowerPoint、CSV、图片等多种格式
- [x] **多模态支持** - 完整的图像和文档处理功能
- [x] **TypeScript 类型安全** - 修复所有构建错误
- [x] **生产环境构建** - 通过 `npm run build` 测试

### 🔧 技术栈
- **框架**: Next.js 14.2.29
- **语言**: TypeScript 5.8.3
- **样式**: Tailwind CSS 3.4.17
- **UI组件**: React 18.3.1
- **数学渲染**: KaTeX 0.16.4
- **文档处理**: Mammoth, XLSX, JSZip, PapaParse
- **网络**: Axios, Proxy支持

## 🌐 Render 部署配置

### 📁 配置文件
```yaml
# render.yaml
services:
  - type: web
    name: personal-ai-website
    env: node 18
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### 🔑 环境变量设置
在 Render 控制台中设置以下环境变量：

```bash
# 必需的环境变量
NODE_ENV=production

# API 密钥（可选，用户可在前端设置）
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
XAI_API_KEY=your_xai_key_here

# 网络配置（可选）
HTTP_PROXY=your_proxy_if_needed
HTTPS_PROXY=your_proxy_if_needed
```

## 📦 部署步骤

### 1. 代码准备
```bash
# 确保所有更改已提交
git add .
git commit -m "feat: 完成第一期优化，准备部署"
git push origin main
```

### 2. Render 部署
1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 "New +" → "Web Service"
3. 连接 GitHub 仓库
4. 配置部署设置：
   - **Name**: `personal-ai-website`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: `18`

### 3. 环境变量配置
在 Render 服务设置中添加环境变量（见上方列表）

### 4. 部署验证
- 检查构建日志
- 验证所有功能正常工作
- 测试文件上传功能
- 确认所有AI模型可用

## 🎯 新功能亮点

### 📅 知识截断显示
- 在模型选择器中显示每个模型的知识截断时间
- 格式：`🧠 推理 • 🛠️ 工具 • 📋 结构化 • 📅 2024-06`

### 🔄 默认模型优化
- **OpenAI**: GPT-4.1 作为默认（最新旗舰模型）
- **XAI**: Grok-3-latest 作为默认（企业级模型）

### 🎨 UI 层级修复
- 用户菜单使用 React Portal 渲染到 body
- 解决被对话框和模型选择器遮挡的问题
- 动态定位计算，确保正确对齐

### 📄 增强文件处理
- **Word文档**: 使用 Mammoth 提取文本
- **Excel表格**: 完整工作表解析，支持多sheet
- **PowerPoint**: XML解析提取幻灯片文本
- **图片文件**: Base64转换，支持多模态模型
- **CSV数据**: 结构化解析，表格预览

## 🔍 监控和维护

### 📊 性能指标
- 首次加载时间: ~365KB
- 构建时间: ~30秒
- 支持的文件格式: 15+种

### 🐛 已知问题
- ESLint 警告（非阻塞性）
- 某些旧版Office文件需要转换

### 🔄 后续优化计划
- 添加更多AI模型支持
- 优化文件处理性能
- 增强错误处理机制
- 添加用户认证系统

## 📞 支持信息

### 🆘 故障排除
1. **构建失败**: 检查 Node.js 版本 (需要 >=18.0.0)
2. **API错误**: 验证环境变量设置
3. **文件上传问题**: 检查文件大小和格式限制
4. **网络问题**: 配置代理设置

### 📚 文档链接
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Render 部署指南](https://render.com/docs/deploy-nextjs-app)
- [项目技术文档](./PROJECT_DOCUMENTATION.md)

---

**部署状态**: ✅ 准备就绪  
**最后更新**: 2025年1月  
**版本**: v1.0.0 - 第一期优化完成 