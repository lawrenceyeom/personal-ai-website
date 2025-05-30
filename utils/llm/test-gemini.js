// utils/llm/test-gemini.js
// Gemini API 连接测试脚本

const axios = require('axios');

async function testGeminiConnection() {
  console.log('🧪 开始测试 Gemini API 连接...');
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.log('❌ 没有找到 Gemini API 密钥');
    console.log('请设置环境变量: GEMINI_API_KEY 或 GOOGLE_API_KEY');
    return;
  }
  
  console.log('✅ 找到 API 密钥');
  
  try {
    // 测试1: 列出可用模型
    console.log('\n📋 测试1: 列出可用模型...');
    const modelsResponse = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 模型列表获取成功');
    const models = modelsResponse.data.models || [];
    console.log(`📦 找到 ${models.length} 个可用模型:`);
    models.slice(0, 5).forEach(model => {
      console.log(`   - ${model.name} (${model.displayName})`);
    });
    
    // 测试2: 简单的文本生成
    console.log('\n💬 测试2: 简单的文本生成...');
    const generateResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: "简单回答：1+1等于多少？"
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 文本生成成功');
    const result = generateResponse.data;
    if (result.candidates && result.candidates[0]) {
      const content = result.candidates[0].content.parts[0].text;
      console.log('📝 生成的回答:', content.trim());
    }
    
    // 测试3: 流式生成
    console.log('\n🌊 测试3: 流式文本生成...');
    const streamResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: "用一句话介绍一下自己"
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );
    
    console.log('✅ 流式生成开始');
    let streamContent = '';
    
    return new Promise((resolve, reject) => {
      streamResponse.data.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.substring(6).trim();
            
            if (!data || data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content) {
                const parts = parsed.candidates[0].content.parts;
                for (const part of parts) {
                  if (part.text) {
                    streamContent += part.text;
                    process.stdout.write(part.text);
                  }
                }
              }
            } catch (e) {
              console.log('\n⚠️ 解析错误:', e.message);
            }
          }
        }
      });
      
      streamResponse.data.on('end', () => {
        console.log('\n✅ 流式生成完成');
        console.log('📝 完整内容:', streamContent.trim());
        resolve();
      });
      
      streamResponse.data.on('error', (error) => {
        console.log('\n❌ 流式生成错误:', error.message);
        reject(error);
      });
    });
    
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.log('HTTP状态:', error.response.status);
      console.log('错误详情:', error.response.data);
    }
  }
}

// 运行测试
testGeminiConnection().then(() => {
  console.log('\n🎉 Gemini API 测试完成！');
}).catch((error) => {
  console.log('\n💥 测试异常:', error.message);
}); 