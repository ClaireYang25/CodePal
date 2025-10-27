/**
 * Gmail OTP AutoFill - Offscreen Document
 * 在窗口上下文中运行 Gemini Nano
 */

let session = null;
let isInitialized = false;

/**
 * 初始化 Gemini Nano
 */
async function initializeNano() {
  try {
    if (typeof globalThis.LanguageModel === 'undefined') {
      console.error('❌ LanguageModel API not available');
      console.error('Please enable: chrome://flags/#prompt-api-for-gemini-nano');
      return false;
    }

    const availability = await globalThis.LanguageModel.availability();
    console.log('Gemini Nano availability:', availability);

    if (availability === 'no') {
      console.error('❌ Gemini Nano not available on this device');
      return false;
    }

    if (availability === 'after-download') {
      console.log('⏬ Gemini Nano needs to be downloaded...');
    }

    // 创建会话
    session = await globalThis.LanguageModel.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`⏬ Model download: ${Math.round(e.loaded * 100)}%`);
        });
      },
    });

    console.log('✅ Gemini Nano session created');
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini Nano:', error);
    return false;
  }
}

/**
 * 监听来自 Service Worker 的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sendResponse);
  return true; // 保持消息通道开放
});

/**
 * 处理请求
 */
async function handleRequest(request, sendResponse) {
  const handlers = {
    'offscreen-extractOTP': handleExtractOTP,
    'offscreen-testConnection': handleTestConnection
  };

  const handler = handlers[request.action];
  if (handler) {
    await handler(request, sendResponse);
  } else {
    sendResponse({ success: false, error: 'Unknown action' });
  }
}

/**
 * 提取 OTP
 */
async function handleExtractOTP(request, sendResponse) {
  try {
    // 确保已初始化
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({
          success: false,
          error: 'Gemini Nano not available. Check chrome://flags settings.'
        });
        return;
      }
    }

    if (!session) {
      sendResponse({ success: false, error: 'Session not created' });
      return;
    }

    const prompt = buildPrompt(request.emailContent, request.language);
    const result = await session.prompt(prompt);
    const parsed = parseResponse(result);
    
    sendResponse(parsed);
  } catch (error) {
    console.error('❌ OTP extraction failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 测试连接
 */
async function handleTestConnection(request, sendResponse) {
  try {
    if (!isInitialized) {
      const success = await initializeNano();
      if (!success) {
        sendResponse({ success: false, error: 'Gemini Nano not available' });
        return;
      }
    }

    if (!session) {
      sendResponse({ success: false, error: 'Session not created' });
      return;
    }

    const result = await session.prompt('请回复"连接成功"');
    sendResponse({
      success: true,
      message: 'Gemini Nano connected',
      response: result
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 构建提示词
 */
function buildPrompt(emailContent, language) {
  const instructions = {
    zh: '这是中文邮件，识别"验证码"相关词汇。',
    en: 'This is English email, identify "verification code", "OTP", "PIN".',
    es: 'Correo español, identifica "código de verificación".',
    it: 'Email italiano, identifica "codice di verifica".',
    auto: '自动检测语言并识别验证码。'
  };

  return `你是验证码提取助手。从邮件中提取一次性验证码(OTP)。

${instructions[language] || instructions.auto}

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

/**
 * 解析响应
 */
function parseResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in response' };
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
      error: `Parsing failed: ${error.message}`
    };
  }
}

console.log('✅ Offscreen document loaded, waiting for requests...');

