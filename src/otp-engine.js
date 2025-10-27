/**
 * Gmail OTP AutoFill - OTP 识别引擎
 * 多语言 OTP 识别规则和本地匹配系统
 */

export class OTPEngine {
  constructor() {
    this.rules = this.initializeRules();
    this.confidenceThreshold = 0.8;
  }

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
          /(\d{6})/g,  // 6位数字
          /(\d{4})/g,  // 4位数字
          /(\d{8})/g   // 8位数字
        ],
        keywords: [],
        contexts: []
      }
    };
  }

  async extractOTP(content, language = 'auto') {
    try {
      // 清理内容
      const cleanContent = this.cleanContent(content);
      
      // 检测语言
      const detectedLanguage = language === 'auto' ? 
        this.detectLanguage(cleanContent) : language;
      
      // 按优先级尝试匹配
      const results = [];
      
      // 1. 特定语言规则
      if (this.rules[detectedLanguage]) {
        const result = this.matchWithRules(cleanContent, this.rules[detectedLanguage]);
        if (result) results.push({ ...result, language: detectedLanguage, priority: 1 });
      }
      
      // 2. 英文规则（作为备选）
      if (detectedLanguage !== 'en') {
        const result = this.matchWithRules(cleanContent, this.rules.en);
        if (result) results.push({ ...result, language: 'en', priority: 2 });
      }
      
      // 3. 通用数字模式
      const universalResult = this.matchWithRules(cleanContent, this.rules.universal);
      if (universalResult) results.push({ ...universalResult, language: 'universal', priority: 3 });
      
      // 选择最佳结果
      const bestResult = this.selectBestResult(results, cleanContent);
      
      return {
        success: bestResult ? bestResult.confidence >= this.confidenceThreshold : false,
        otp: bestResult ? bestResult.otp : null,
        confidence: bestResult ? bestResult.confidence : 0,
        method: 'local',
        language: bestResult ? bestResult.language : detectedLanguage,
        context: bestResult ? bestResult.context : null
      };
    } catch (error) {
      console.error('OTP extraction error:', error);
      return { success: false, error: error.message };
    }
  }

  cleanContent(content) {
    return content
      .replace(/\s+/g, ' ')  // 合并多个空格
      .replace(/[^\w\s\d：:]/g, '')  // 移除特殊字符
      .trim();
  }

  detectLanguage(content) {
    const chineseRegex = /[\u4e00-\u9fff]/;
    const spanishRegex = /[ñáéíóúü]/i;
    const italianRegex = /[àèéìíîòóù]/i;
    const englishRegex = /[a-zA-Z]/;

    if (chineseRegex.test(content)) return 'zh';
    if (spanishRegex.test(content)) return 'es';
    if (italianRegex.test(content)) return 'it';
    if (englishRegex.test(content)) return 'en';
    
    return 'universal';
  }

  matchWithRules(content, rules) {
    let bestMatch = null;
    let highestConfidence = 0;

    // 尝试所有模式
    for (const pattern of rules.patterns) {
      const matches = content.match(pattern);
      if (matches && matches[1]) {
        const otp = matches[1];
        const confidence = this.calculateConfidence(content, otp, rules);
        
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            otp: otp,
            confidence: confidence,
            context: this.extractContext(content, matches[0])
          };
        }
      }
    }

    return bestMatch;
  }

  calculateConfidence(content, otp, rules) {
    let confidence = 0.5; // 基础置信度
    
    // 关键词匹配加分
    const keywordMatches = rules.keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    confidence += keywordMatches * 0.1;
    
    // 上下文匹配加分
    const contextMatches = rules.contexts.filter(context => 
      content.toLowerCase().includes(context.toLowerCase())
    ).length;
    confidence += contextMatches * 0.15;
    
    // OTP 长度加分
    if (otp.length === 6) confidence += 0.2;
    else if (otp.length === 4) confidence += 0.15;
    else if (otp.length >= 4 && otp.length <= 8) confidence += 0.1;
    
    // 位置加分（邮件开头或结尾的 OTP 更可信）
    const otpPosition = content.indexOf(otp);
    const contentLength = content.length;
    if (otpPosition < contentLength * 0.1 || otpPosition > contentLength * 0.9) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  extractContext(content, match) {
    const matchIndex = content.indexOf(match);
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(content.length, matchIndex + match.length + 50);
    return content.substring(start, end);
  }

  selectBestResult(results, content) {
    if (results.length === 0) return null;
    
    // 按优先级和置信度排序
    results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.confidence - a.confidence;
    });
    
    return results[0];
  }

  // 验证 OTP 格式
  isValidOTP(otp) {
    if (!otp || typeof otp !== 'string') return false;
    
    // 检查是否为纯数字
    if (!/^\d+$/.test(otp)) return false;
    
    // 检查长度（通常 4-8 位）
    if (otp.length < 4 || otp.length > 8) return false;
    
    return true;
  }

  // 获取支持的语言列表
  getSupportedLanguages() {
    return Object.keys(this.rules).filter(lang => lang !== 'universal');
  }
}
