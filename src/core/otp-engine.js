/**
 * Gmail OTP AutoFill - OTP 识别引擎
 * 多语言 OTP 识别规则和本地匹配系统
 */

export class OTPEngine {
  constructor() {
    this.rules = this.initializeRules();
    this.confidenceThreshold = 0.8;
  }

  /**
   * 初始化多语言识别规则
   */
  initializeRules() {
    return {
      // 中文规则
      zh: {
        patterns: [
          /验证码[：:]\s*(\d{4,8})/i,
          /验证码为[：:]\s*(\d{4,8})/i,
          /您的验证码[：:]\s*(\d{4,8})/i,
          /验证码\s*(\d{4,8})/i,
          /code[：:]\s*(\d{4,8})/i,
          /(\d{4,8})\s*是您的验证码/i,
          /(\d{6})\s*验证码/i
        ],
        keywords: ['验证码', '验证', 'code', '代码'],
        contexts: ['登录', '注册', '安全验证', '身份验证']
      },
      
      // 英文规则
      en: {
        patterns: [
          /verification code[：:]\s*(\d{4,8})/i,
          /verification code is[：:]\s*(\d{4,8})/i,
          /your code[：:]\s*(\d{4,8})/i,
          /code[：:]\s*(\d{4,8})/i,
          /otp[：:]\s*(\d{4,8})/i,
          /pin[：:]\s*(\d{4,8})/i,
          /(\d{4,8})\s*is your verification code/i,
          /(\d{6})\s*verification code/i,
          /use code\s*(\d{4,8})/i
        ],
        keywords: ['verification', 'code', 'otp', 'pin', 'token'],
        contexts: ['login', 'signup', 'security', 'authentication']
      },
      
      // 西班牙语规则
      es: {
        patterns: [
          /código de verificación[：:]\s*(\d{4,8})/i,
          /código[：:]\s*(\d{4,8})/i,
          /tu código[：:]\s*(\d{4,8})/i,
          /(\d{4,8})\s*es tu código/i,
          /(\d{6})\s*código de verificación/i
        ],
        keywords: ['código', 'verificación', 'code'],
        contexts: ['inicio', 'registro', 'seguridad']
      },
      
      // 意大利语规则
      it: {
        patterns: [
          /codice di verifica[：:]\s*(\d{4,8})/i,
          /codice[：:]\s*(\d{4,8})/i,
          /il tuo codice[：:]\s*(\d{4,8})/i,
          /(\d{4,8})\s*è il tuo codice/i,
          /(\d{6})\s*codice di verifica/i
        ],
        keywords: ['codice', 'verifica', 'code'],
        contexts: ['accesso', 'registrazione', 'sicurezza']
      },
      
      // 通用数字模式
      universal: {
        patterns: [
          /(\d{6})/g,
          /(\d{4})/g,
          /(\d{8})/g
        ],
        keywords: [],
        contexts: []
      }
    };
  }

  /**
   * 从邮件内容中提取 OTP
   * @param {string} content - 邮件内容
   * @param {string} language - 语言代码 ('auto', 'zh', 'en', 'es', 'it')
   * @returns {Promise<Object>} 提取结果
   */
  async extractOTP(content, language = 'auto') {
    try {
      const cleanContent = this.cleanContent(content);
      const detectedLanguage = language === 'auto' ? 
        this.detectLanguage(cleanContent) : language;
      
      const results = [];
      
      // 1. 特定语言规则匹配
      if (this.rules[detectedLanguage]) {
        const result = this.matchWithRules(cleanContent, this.rules[detectedLanguage]);
        if (result) results.push({ ...result, language: detectedLanguage, priority: 1 });
      }
      
      // 2. 英文规则作为备选
      if (detectedLanguage !== 'en') {
        const result = this.matchWithRules(cleanContent, this.rules.en);
        if (result) results.push({ ...result, language: 'en', priority: 2 });
      }
      
      // 3. 通用数字模式
      const universalResult = this.matchWithRules(cleanContent, this.rules.universal);
      if (universalResult) results.push({ ...universalResult, language: 'universal', priority: 3 });
      
      const bestResult = this.selectBestResult(results);
      
      return {
        success: bestResult ? bestResult.confidence >= this.confidenceThreshold : false,
        otp: bestResult ? bestResult.otp : null,
        confidence: bestResult ? bestResult.confidence : 0,
        method: 'local-regex',
        language: bestResult ? bestResult.language : detectedLanguage
      };
    } catch (error) {
      console.error('OTP extraction error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理邮件内容
   */
  cleanContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\d：:]/g, '')
      .trim();
  }

  /**
   * 检测语言
   */
  detectLanguage(content) {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const spanishRegex = /[ñáéíóúü]/i;
    const italianRegex = /[àèéìíîòóù]/i;

    if (chineseRegex.test(content)) return 'zh';
    if (spanishRegex.test(content)) return 'es';
    if (italianRegex.test(content)) return 'it';
    
    return 'en';
  }

  /**
   * 使用规则匹配
   */
  matchWithRules(content, rules) {
    let bestMatch = null;
    let highestConfidence = 0;

    for (const pattern of rules.patterns) {
      const matches = content.match(pattern);
      if (matches && matches[1]) {
        const otp = matches[1];
        const confidence = this.calculateConfidence(content, otp, rules);
        
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = { otp, confidence };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 计算置信度
   */
  calculateConfidence(content, otp, rules) {
    let confidence = 0.5;
    
    // 关键词匹配
    const keywordMatches = rules.keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    confidence += keywordMatches * 0.1;
    
    // 上下文匹配
    const contextMatches = rules.contexts.filter(context => 
      content.toLowerCase().includes(context.toLowerCase())
    ).length;
    confidence += contextMatches * 0.15;
    
    // OTP 长度评分
    if (otp.length === 6) confidence += 0.2;
    else if (otp.length === 4) confidence += 0.15;
    else if (otp.length >= 4 && otp.length <= 8) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 选择最佳结果
   */
  selectBestResult(results) {
    if (results.length === 0) return null;
    
    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    });
    
    return results[0];
  }

  /**
   * 验证 OTP 格式
   */
  isValidOTP(otp) {
    if (!otp || typeof otp !== 'string') return false;
    if (!/^\d+$/.test(otp)) return false;
    if (otp.length < 4 || otp.length > 8) return false;
    return true;
  }
}

