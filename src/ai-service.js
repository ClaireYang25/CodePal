import { ChromePromptAPIService } from './chrome-prompt-api.js';

/**
 * Gmail OTP AutoFill - AI 服务
 * 集成 Gemini Nano API 进行智能 OTP 识别
 */

export class AIService {
  constructor() {
    this.apiKey = null;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-1.5-flash';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.chromePromptAPI = null;
    this.preferredMethod = 'chrome-prompt-api'; // 优先使用 Chrome Prompt API
    this.init();
  }

  async init() {
    try {
      // ChromePromptAPIService 只能在窗口上下文中初始化。
      // 我们检查 `self.window`，它在窗口中存在，但在 service worker 中不存在。
      if (typeof window !== 'undefined') {
        this.chromePromptAPI = new ChromePromptAPIService();
      } else {
        this.chromePromptAPI = null;
        console.log("Service Worker context: Chrome Prompt API will not be initialized here.");
      }

      // 从存储中获取 API 密钥（备用方案）
      this.apiKey = await this.getAPIKey();
      
      if (!this.apiKey) {
        console.warn('Gemini API key not found. Will use Chrome Prompt API as primary method.');
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
    return new Promise((resolve) => {
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        this.apiKey = apiKey;
        resolve();
      });
    });
  }

  async extractOTP(emailContent, language = 'auto') {
    // 注意：Chrome Prompt API 调用应该由 background.js 直接处理
    // 这里只处理 Gemini API 的情况
    
    // 备用方案：使用 Gemini API
    if (!this.apiKey) {
      throw new Error('No AI service available. Please configure Gemini API key.');
    }

    const prompt = this.buildOTPExtractionPrompt(emailContent, language);
    const response = await this.callGeminiAPI(prompt);
    
    return this.parseOTPResponse(response);
  }

  buildOTPExtractionPrompt(emailContent, language) {
    const languageInstructions = this.getLanguageInstructions(language);
    
    return `你是一个专业的邮件验证码提取助手。请从以下邮件内容中提取一次性验证码（OTP）。

${languageInstructions}

邮件内容：
"""
${emailContent}
"""

请按照以下格式返回结果：
{
  "otp": "提取到的验证码",
  "confidence": 0.95,
  "reasoning": "提取理由",
  "language": "检测到的语言",
  "context": "验证码出现的上下文"
}

规则：
1. 只提取数字验证码（4-8位）
2. 如果找到多个可能的验证码，选择最可能是OTP的那个
3. 如果找不到验证码，otp字段设为null
4. confidence范围0-1，表示提取的置信度
5. 如果邮件不是验证码邮件，otp设为null，confidence设为0

请直接返回JSON格式，不要包含其他内容。`;
  }

  getLanguageInstructions(language) {
    const instructions = {
      zh: '这是中文邮件，请识别中文验证码相关词汇如"验证码"、"验证"等。',
      en: 'This is an English email, please identify English verification code related words like "verification code", "OTP", "PIN" etc.',
      es: 'Este es un correo en español, por favor identifica palabras relacionadas con códigos de verificación como "código de verificación", "código" etc.',
      it: 'Questa è un\'email in italiano, per favore identifica parole relative ai codici di verifica come "codice di verifica", "codice" etc.',
      auto: '请自动检测邮件语言并相应识别验证码。支持中文、英文、西班牙语、意大利语。'
    };
    
    return instructions[language] || instructions.auto;
  }

  async callGeminiAPI(prompt) {
    const url = `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 500
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          if (response.status === 429 && attempt < this.maxRetries) {
            // 速率限制，等待后重试
            await this.delay(this.retryDelay * attempt);
            continue;
          }
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`API error: ${data.error.message}`);
        }

        return data;
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        console.warn(`API call attempt ${attempt} failed:`, error.message);
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  parseOTPResponse(apiResponse) {
    try {
      const text = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No response text from API');
      }

      // 尝试解析JSON响应
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      // 验证结果格式
      if (typeof result !== 'object' || result === null) {
        throw new Error('Invalid response format');
      }

      return {
        success: result.otp !== null && result.confidence > 0.5,
        otp: result.otp,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
        language: result.language || 'unknown',
        context: result.context || '',
        method: 'ai'
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        success: false,
        error: `Response parsing failed: ${error.message}`,
        method: 'ai'
      };
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test Connection logic (Gemini API only)
  async testConnection() {
    if (!this.apiKey) {
      return { success: false, error: 'Gemini API key not configured.' };
    }
    
    try {
      const testPrompt = '请回复"连接成功"';
      const response = await this.callGeminiAPI(testPrompt);
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.includes('连接成功')) {
        return { 
          success: true, 
          message: 'Gemini API connection successful',
          model: this.model
        };
      }
      return { success: false, error: 'Gemini API did not respond as expected.' };
    } catch (error) {
      return { 
        success: false, 
        error: `Gemini API test failed: ${error.message}` 
      };
    }
  }

  // 获取API使用统计
  async getUsageStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiUsageStats'], (result) => {
        resolve(result.aiUsageStats || {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          lastUsed: null
        });
      });
    });
  }

  // 更新使用统计
  async updateUsageStats(success) {
    const stats = await this.getUsageStats();
    
    stats.totalRequests++;
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
    stats.lastUsed = Date.now();

    return new Promise((resolve) => {
      chrome.storage.local.set({ aiUsageStats: stats }, resolve);
    });
  }
}