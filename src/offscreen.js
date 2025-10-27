/**
 * Gmail OTP AutoFill - Offscreen Document
 * 在窗口上下文中运行 Chrome Prompt API (Gemini Nano)
 */

// 初始化标志
let isInitialized = false;
let session = null;

// 初始化 Gemini Nano
async function initializeNano() {
  try {
    // 检查 LanguageModel API 是否可用
    if (typeof globalThis.LanguageModel === 'undefined') {
      console.error('LanguageModel API not available. Please enable chrome://flags/#prompt-api-for-gemini-nano');
      return false;
    }

    // 检查可用性
    const availability = await globalThis.LanguageModel.availability();
    console.log('Gemini Nano availability:', availability);

    if (availability === 'no') {
      console.error('Gemini Nano is not available on this device.');
      return false;
    }

    if (availability === 'after-download') {
      console.log('Gemini Nano needs to be downloaded. This may take a while...');
      // 继续创建会话，这会触发下载
    }

    // 创建会话
    session = await globalThis.LanguageModel.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Gemini Nano downloaded: ${Math.round(e.loaded * 100)}%`);
        });
      },
    });

    console.log('Gemini Nano session created successfully');
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Gemini Nano:', error);
    return false;
  }
}

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sendResponse);
  return true; // 保持消息通道开放
});

async function handleRequest(request, sendResponse) {
  // 根据 action 类型处理不同的请求
  if (request.action === 'offscreen-extractOTP') {
    await handleExtractOTP(request, sendResponse);
  } else if (request.action === 'offscreen-testConnection') {
    await handleTestConnection(sendResponse);
  }
}

async function handleExtractOTP(request, sendResponse) {
  try {
    // 确保已初始化
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({
          success: false,
          error: 'Gemini Nano is not available. Please check chrome://flags settings.'
        });
        return;
      }
    }

    if (!session) {
      sendResponse({
        success: false,
        error: 'Gemini Nano session not created.'
      });
      return;
    }

    // 构建 prompt
    const prompt = buildOTPExtractionPrompt(request.emailContent, request.language);

    // 调用 Gemini Nano
    const result = await session.prompt(prompt);

    // 解析响应
    const parsed = parseOTPResponse(result);
    sendResponse(parsed);
  } catch (error) {
    console.error('OTP extraction failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleTestConnection(sendResponse) {
  try {
    // 确保已初始化
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({
          success: false,
          error: 'Gemini Nano is not available.'
        });
        return;
      }
    }

    if (!session) {
      sendResponse({
        success: false,
        error: 'Gemini Nano session not created.'
      });
      return;
    }

    // 测试简单的提示
    const result = await session.prompt('请回复"连接成功"');

    sendResponse({
      success: true,
      message: 'Gemini Nano connection successful',
      response: result
    });
  } catch (error) {
    console.error('Test connection failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

function buildOTPExtractionPrompt(emailContent, language) {
  const languageInstructions = {
    zh: '这是中文邮件，请识别"验证码"相关词汇。',
    en: 'This is English email, identify "verification code", "OTP", "PIN".',
    es: 'Correo en español, identifica "código de verificación".',
    it: 'Email italiano, identifica "codice di verifica".',
    auto: '自动检测语言并识别验证码。'
  };

  const instruction = languageInstructions[language] || languageInstructions.auto;

  return `你是验证码提取助手。从邮件中提取一次性验证码(OTP)。

${instruction}

邮件内容：
"""
${emailContent}
"""

返回JSON格式：
{
  "otp": "验证码（4-8位数字）",
  "confidence": 0.95,
  "reasoning": "提取理由"
}

规则：
1. 只提取4-8位数字
2. 找不到时otp设为null
3. 直接返回JSON，不要其他内容

JSON:`;
}

function parseOTPResponse(response) {
  try {
    // 尝试提取 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'No JSON found in response'
      };
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      success: result.otp !== null && result.confidence > 0.5,
      otp: result.otp,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || '',
      method: 'gemini-nano'
    };
  } catch (error) {
    return {
      success: false,
      error: `Response parsing failed: ${error.message}`
    };
  }
}

// 页面加载时初始化
console.log('Offscreen document loaded, waiting for requests...');
