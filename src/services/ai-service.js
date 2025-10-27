/**
 * AI 服务 - Gemini API
 * 作为 Gemini Nano 的备用方案
 */

export class AIService {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.init();
  }

  async init() {
    try {
      this.apiKey = await this.getAPIKey();
      if (!this.apiKey) {
        console.warn('Gemini API key not configured. Using Gemini Nano only.');
      }
    } catch (error) {
      console.error('AI Service initialization failed:', error);
    }
  }

  async getAPIKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        resolve(result.geminiApiKey);
      });
    });
  }

  async setAPIKey(apiKey) {
    this.apiKey = apiKey;
    return new Promise((resolve) => {
      chrome.storage.local.set({ geminiApiKey: apiKey }, resolve);
    });
  }

  /**
   * 使用 Gemini API 提取 OTP
   * @param {string} emailContent - 邮件内容
   * @param {string} language - 语言代码
   * @returns {Promise<Object>} 提取结果
   */
  async extractOTP(emailContent, language = 'auto') {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured.');
    }

    const prompt = this.buildPrompt(emailContent, language);
    const response = await this.callAPI(prompt);
    return this.parseResponse(response);
  }

  /**
   * 构建提示词
   */
  buildPrompt(emailContent, language) {
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
3. 直接返回JSON，不要其他内容`;
  }

  /**
   * 调用 Gemini API
   */
  async callAPI(prompt) {
    const url = `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 500
      }
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          if (response.status === 429 && attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
            continue;
          }
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(`API error: ${data.error.message}`);
        }

        return data;
      } catch (error) {
        if (attempt === this.maxRetries) throw error;
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  /**
   * 解析 API 响应
   */
  parseResponse(apiResponse) {
    try {
      const text = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response text from API');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const result = JSON.parse(jsonMatch[0]);

      return {
        success: result.otp !== null && result.confidence > 0.5,
        otp: result.otp,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
        method: 'gemini-api'
      };
    } catch (error) {
      return {
        success: false,
        error: `Response parsing failed: ${error.message}`,
        method: 'gemini-api'
      };
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection() {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await this.callAPI('请回复"连接成功"');
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text && text.includes('连接成功')) {
        return { 
          success: true, 
          message: 'Gemini API connected',
          model: this.model
        };
      }
      
      return { success: false, error: 'Unexpected response' };
    } catch (error) {
      return { 
        success: false, 
        error: `Connection test failed: ${error.message}` 
      };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

