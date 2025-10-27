/**
 * Gmail OTP AutoFill - Chrome Prompt API 服务
 * 使用 Chrome 内置的 Prompt API 进行本地 AI 处理
 * 
 * 注意：此服务已被 offscreen.js 替代，这里保留仅用于兼容性
 */

export class ChromePromptAPIService {
  constructor() {
    this.isAvailable = false;
    this.session = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // 检查 Prompt API 是否可用（使用正确的全局对象）
      if (typeof globalThis.LanguageModel !== 'undefined') {
        const availability = await globalThis.LanguageModel.availability();
        this.isAvailable = (availability !== 'no');
        
        if (this.isAvailable) {
          console.log('Chrome Prompt API (Gemini Nano) 可用');
          await this.createSession();
        } else {
          console.warn('Gemini Nano 不可用，请检查硬件要求');
        }
      } else {
        console.warn('LanguageModel API 未找到，请启用 chrome://flags/#prompt-api-for-gemini-nano');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Chrome Prompt API 初始化失败:', error);
      this.isInitialized = true;
    }
  }

  async createSession() {
    try {
      if (!this.isAvailable) {
        throw new Error('Prompt API 不可用');
      }

      // 使用正确的 API 创建会话
      this.session = await globalThis.LanguageModel.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(`模型下载进度: ${Math.round(e.loaded * 100)}%`);
          });
        },
      });
      
      console.log('Prompt API 会话创建成功');
    } catch (error) {
      console.error('创建 Prompt API 会话失败:', error);
      this.session = null;
    }
  }

  async extractOTP(emailContent, language = 'auto') {
    try {
      if (!this.session) {
        throw new Error('Prompt API 会话未创建');
      }

      const prompt = this.buildOTPExtractionPrompt(emailContent, language);
      
      // 使用 Prompt API 处理
      const result = await this.session.prompt(prompt);
      
      return this.parseOTPResponse(result);
    } catch (error) {
      console.error('Prompt API OTP 提取失败:', error);
      throw error;
    }
  }

  buildOTPExtractionPrompt(emailContent, language) {
    const languageInstructions = this.getLanguageInstructions(language);
    
    return `你是一个专业的邮件验证码提取助手。请从以下邮件内容中提取一次性验证码（OTP）。

${languageInstructions}

邮件内容：
"""
${emailContent}
"""

请按照以下JSON格式返回结果：
{
  "otp": "提取到的验证码（纯数字，4-8位）",
  "confidence": 0.95,
  "reasoning": "提取理由和判断依据"
}

规则：
1. 只提取数字验证码（4-8位）
2. 如果找不到验证码，otp设为null，confidence设为0
3. confidence范围0-1，表示提取的置信度

请直接返回JSON格式，不要包含其他内容。`;
  }

  getLanguageInstructions(language) {
    const instructions = {
      zh: '这是中文邮件，请识别中文验证码相关词汇如"验证码"、"验证"等。',
      en: 'This is an English email, please identify English verification code related words like "verification code", "OTP", "PIN" etc.',
      es: 'Este es un correo en español, por favor identifica palabras relacionadas con códigos de verificación.',
      it: 'Questa è un\'email in italiano, per favore identifica parole relative ai codici di verifica.',
      auto: '请自动检测邮件语言并相应识别验证码。支持中文、英文、西班牙语、意大利语。'
    };
    
    return instructions[language] || instructions.auto;
  }

  parseOTPResponse(response) {
    try {
      // 尝试解析JSON响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        success: result.otp !== null && result.confidence > 0.5,
        otp: result.otp,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || '',
        method: 'chrome-prompt-api'
      };
    } catch (error) {
      console.error('Failed to parse Prompt API response:', error);
      return {
        success: false,
        error: `Response parsing failed: ${error.message}`,
        method: 'chrome-prompt-api'
      };
    }
  }

  // 测试 Prompt API 连接
  async testConnection() {
    try {
      if (!this.isAvailable) {
        return { success: false, error: 'Prompt API not available' };
      }

      if (!this.session) {
        await this.createSession();
      }

      const testPrompt = '请回复"连接成功"';
      const result = await this.session.prompt(testPrompt);
      
      return { 
        success: true, 
        message: 'Chrome Prompt API connection successful',
        response: result
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 销毁会话
  async destroySession() {
    try {
      if (this.session) {
        this.session.destroy();
        this.session = null;
        console.log('Prompt API 会话已销毁');
      }
    } catch (error) {
      console.error('销毁 Prompt API 会话失败:', error);
    }
  }
}
