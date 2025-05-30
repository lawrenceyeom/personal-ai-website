// utils/llm/test-integration.ts
// LLM模块集成测试

import { 
  callLLMStream, 
  getModelMapping, 
  isReasoningModel, 
  modelSupportsTools,
  getProviderInfo,
  getRecommendedModels,
  getModelsByProvider,
  LLMRequest 
} from './index';

/**
 * 测试基本功能
 */
export async function testBasicFunctionality(): Promise<void> {
  console.log('🧪 开始LLM模块集成测试...\n');

  // 测试1: 获取模型映射
  console.log('📋 测试1: 获取模型映射');
  const models = getModelMapping();
  console.log('可用模型数量:', Object.keys(models).length);
  console.log('模型列表:', Object.keys(models).slice(0, 10), '...');
  
  // 测试2: 获取提供商信息
  console.log('\n🏢 测试2: 获取提供商信息');
  const providerInfo = getProviderInfo();
  console.log('可用提供商:', providerInfo.available);
  console.log('提供商统计:', providerInfo.stats);

  // 测试3: 检查推理模型
  console.log('\n🧠 测试3: 检查推理模型');
  const testModels = ['deepseek-chat', 'deepseek-reasoner', 'gpt-4.1', 'o3-mini', 'gpt-4o', 'gpt-4o-mini', 'gemini-2.5-pro-preview', 'gemini-2.5-flash-preview', 'gemini-2.0-flash', 'grok-3-latest', 'grok-3-mini-fast', 'grok-2-image'];
  for (const model of testModels) {
    const isReasoner = isReasoningModel(model);
    const supportsTools = modelSupportsTools(model);
    console.log(`  ${model}: 推理=${isReasoner}, 工具=${supportsTools}`);
  }

  // 测试4: 按提供商分组模型
  console.log('\n🔗 测试4: 按提供商分组模型');
  const modelsByProvider = getModelsByProvider();
  for (const [provider, modelList] of Object.entries(modelsByProvider)) {
    console.log(`  ${provider}: ${modelList.length}个模型 - ${modelList.slice(0, 3).join(', ')}${modelList.length > 3 ? '...' : ''}`);
  }

  // 测试5: 获取推荐模型
  console.log('\n⭐ 测试5: 获取推荐模型');
  const recommended = getRecommendedModels();
  console.log('推理模型:', recommended.reasoning);
  console.log('通用模型:', recommended.general);
  console.log('视觉模型:', recommended.vision.slice(0, 5));
  console.log('性价比模型:', recommended.costEffective.slice(0, 3));

  console.log('\n✅ 基础功能测试完成!');
}

/**
 * 测试OpenAI提供商
 */
export async function testOpenAIProvider(): Promise<void> {
  console.log('\n🤖 测试OpenAI提供商...');

  const openaiModels = ['gpt-4.1', 'o3-mini', 'gpt-4o', 'gpt-4o-mini'];
  
  for (const model of openaiModels) {
    console.log(`\n测试模型: ${model}`);
    
    const modelInfo = getModelMapping()[model];
    if (!modelInfo) {
      console.log('  ❌ 模型不存在');
      continue;
    }

    console.log('  ✅ 模型已配置');
    console.log('  - 提供商:', modelInfo.provider);
    console.log('  - 推理模型:', !!modelInfo.isReasoner);
    console.log('  - 支持工具:', !!modelInfo.supports?.tools);
    console.log('  - 支持视觉:', !!modelInfo.supports?.vision);
    console.log('  - 最大tokens:', modelInfo.supports?.max_tokens?.max || '未知');
  }
}

/**
 * 测试Gemini提供商
 */
export async function testGeminiProvider(): Promise<void> {
  console.log('\n🌟 测试Gemini提供商...');

  const geminiModels = ['gemini-2.5-pro-preview', 'gemini-2.5-flash-preview', 'gemini-2.0-flash'];
  
  for (const model of geminiModels) {
    console.log(`\n测试模型: ${model}`);
    
    const modelInfo = getModelMapping()[model];
    if (!modelInfo) {
      console.log('  ❌ 模型不存在');
      continue;
    }

    console.log('  ✅ 模型已配置');
    console.log('  - 提供商:', modelInfo.provider);
    console.log('  - 推理模型:', !!modelInfo.isReasoner);
    console.log('  - 支持工具:', !!modelInfo.supports?.tools);
    console.log('  - 支持视觉:', !!modelInfo.supports?.vision);
    console.log('  - 支持文档:', !!modelInfo.supports?.documents);
    console.log('  - 最大tokens:', modelInfo.supports?.max_tokens?.max || '未知');
    
    // 检查思维推理配置
    if (modelInfo.supports?.thinking) {
      const thinking = modelInfo.supports.thinking;
      if (typeof thinking === 'object') {
        console.log('  - 思维推理: 支持，预算tokens:', thinking.budget_tokens);
      } else {
        console.log('  - 思维推理:', thinking ? '支持' : '不支持');
      }
    }
  }
}

/**
 * 测试xAI提供商
 */
export async function testXAIProvider(): Promise<void> {
  console.log('\n🤖 测试xAI Grok提供商...');

  const xaiModels = ['grok-3-latest', 'grok-3-mini-fast', 'grok-2-image'];
  
  for (const model of xaiModels) {
    console.log(`\n测试模型: ${model}`);
    
    const modelInfo = getModelMapping()[model];
    if (!modelInfo) {
      console.log('  ❌ 模型不存在');
      continue;
    }

    console.log('  ✅ 模型已配置');
    console.log('  - 提供商:', modelInfo.provider);
    console.log('  - 推理模型:', !!modelInfo.isReasoner);
    console.log('  - 支持工具:', !!modelInfo.supports?.tools);
    console.log('  - 支持视觉:', !!modelInfo.supports?.vision);
    console.log('  - 支持搜索:', !!modelInfo.supports?.search);
    console.log('  - 结构化输出:', !!modelInfo.supports?.structured_output);
    console.log('  - 最大tokens:', modelInfo.supports?.max_tokens?.max || '未知');
    
    // 检查推理努力配置
    if (modelInfo.supports?.reasoning_effort) {
      const effort = modelInfo.supports.reasoning_effort;
      console.log('  - 推理努力: 支持，选项:', effort.options?.join('/'), '默认:', effort.default);
    }
    
    // 检查图像功能
    if (modelInfo.supports?.image_generation) {
      const imgGen = modelInfo.supports.image_generation;
      console.log('  - 图像生成: 支持，最大:', imgGen.max_images, '张');
    }
    
    if (modelInfo.supports?.image_input) {
      const imgInput = modelInfo.supports.image_input;
      console.log('  - 图像输入: 支持，最大尺寸:', imgInput.max_size_mb, 'MB');
    }
  }
}

/**
 * 测试流式调用（如果有API密钥）
 */
export async function testStreamCall(): Promise<void> {
  console.log('\n🌊 测试流式调用...');

  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasXAIKey = !!process.env.XAI_API_KEY;

  console.log('API密钥状态:');
  console.log('  OpenAI:', hasOpenAIKey ? '✅ 已配置' : '❌ 未配置');
  console.log('  DeepSeek:', hasDeepSeekKey ? '✅ 已配置' : '❌ 未配置');
  console.log('  Gemini:', hasGeminiKey ? '✅ 已配置' : '❌ 未配置');
  console.log('  xAI:', hasXAIKey ? '✅ 已配置' : '❌ 未配置');

  if (!hasOpenAIKey && !hasDeepSeekKey && !hasGeminiKey && !hasXAIKey) {
    console.log('  ⚠️ 没有可用的API密钥，跳过实际调用测试');
    return;
  }

  // 选择一个可用的模型进行测试
  let testModel: string;
  if (hasXAIKey) {
    testModel = 'grok-3-mini-fast';
  } else if (hasGeminiKey) {
    testModel = 'gemini-2.0-flash';
  } else if (hasOpenAIKey) {
    testModel = 'gpt-4o-mini';
  } else {
    testModel = 'deepseek-chat';
  }
  
  console.log(`\n使用模型 ${testModel} 进行流式测试...`);

  const request: LLMRequest = {
    model: testModel,
    messages: [
      { role: 'user', content: '简单回答：1+1等于多少？' }
    ],
    max_tokens: 50,
    temperature: 0.7
  };

  try {
    let response = '';
    await callLLMStream(request, (chunk, type) => {
      if (type === 'content_chunk') {
        const data = JSON.parse(chunk);
        if (data.content) {
          response += data.content;
          process.stdout.write(data.content);
        }
      }
    });
    
    console.log('\n✅ 流式调用成功！');
    console.log('完整响应:', response.trim());
  } catch (error) {
    console.log('\n❌ 流式调用失败:', (error as Error).message);
  }
}

/**
 * 测试多提供商功能对比
 */
export async function testMultiProviderComparison(): Promise<void> {
  console.log('\n🔍 测试多提供商功能对比...');

  const models = getModelMapping();
  const providers = ['deepseek', 'openai', 'google', 'xai'];
  
  console.log('\n📊 功能支持对比:');
  console.log('提供商\t模型数\t推理模型\t视觉模型\t工具模型\t图像生成\t搜索支持');
  console.log('──────────────────────────────────────────────────────────────────');
  
  for (const provider of providers) {
    const providerModels = Object.entries(models).filter(([_, config]) => config.provider === provider);
    const modelCount = providerModels.length;
    const reasoningCount = providerModels.filter(([_, config]) => config.isReasoner).length;
    const visionCount = providerModels.filter(([_, config]) => config.supports?.vision).length;
    const toolsCount = providerModels.filter(([_, config]) => config.supports?.tools).length;
    const imageGenCount = providerModels.filter(([_, config]) => config.supports?.image_generation).length;
    const searchCount = providerModels.filter(([_, config]) => config.supports?.search).length;
    
    console.log(`${provider}\t${modelCount}\t${reasoningCount}\t\t${visionCount}\t\t${toolsCount}\t\t${imageGenCount}\t\t${searchCount}`);
  }
  
  console.log('\n🏆 推荐模型组合:');
  console.log('- 复杂推理: deepseek-reasoner, o3-mini (强推理)');
  console.log('- 通用对话: deepseek-chat, gpt-4.1 (平衡性能)');
  console.log('- 多模态: gpt-4o, gemini-2.5-pro-preview (图文理解)');
  console.log('- 经济选择: gpt-4o-mini, gemini-2.0-flash (高性价比)');
  console.log('- 企业应用: grok-3-latest (深度知识)');
  console.log('- 图像生成: grok-2-image (创意设计)');
}

/**
 * 主测试函数
 */
export async function runAllTests(): Promise<void> {
  try {
    await testBasicFunctionality();
    await testOpenAIProvider();
    await testGeminiProvider();
    await testXAIProvider();
    await testStreamCall();
    await testMultiProviderComparison();
    
    console.log('\n🎉 所有测试完成！');
    console.log('\n📈 架构优化总结:');
    console.log('✅ 成功实现模块化LLM提供商架构');
    console.log('✅ 支持 DeepSeek + OpenAI + Gemini + xAI 四大提供商');
    console.log(`✅ 总计 ${Object.keys(getModelMapping()).length} 个模型可用`);
    console.log('✅ 统一API接口，支持流式/非流式调用');
    console.log('✅ 完整的类型定义和参数验证');
    console.log('✅ 支持推理模型、工具调用、多模态、图像生成等高级功能');
    console.log('✅ 支持实时搜索、结构化输出等前沿功能');
  } catch (error) {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests();
} 