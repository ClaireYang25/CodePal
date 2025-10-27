/**
 * Gmail OTP AutoFill - OTP Recognition Engine
 * Multi-language OTP recognition rules and local matching system
 */

import { CONFIG } from '../config/constants.js';

export class OTPEngine {
  constructor() {
    this.rules = this.initializeRules();
    this.confidenceThreshold = CONFIG.OTP.CONFIDENCE_THRESHOLD;
  }

  /**
   * Initialize multi-language recognition rules
   */
  initializeRules() {
    return {
      // Chinese rules
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
      
      // English rules
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
      
      // Spanish rules
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
      
      // Italian rules
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
      
      // Universal number patterns
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
   * Extract OTP from email content
   * @param {string} content - Email content
   * @param {string} language - Language code ('auto', 'zh', 'en', 'es', 'it')
   * @returns {Promise<Object>} Extraction result
   */
  async extractOTP(content, language = CONFIG.LANGUAGES.AUTO) {
    try {
      const cleanContent = this.cleanContent(content);
      const detectedLanguage = language === CONFIG.LANGUAGES.AUTO ? 
        this.detectLanguage(cleanContent) : language;
      
      const results = [];
      
      // 1. Try specific language rules
      if (this.rules[detectedLanguage]) {
        const result = this.matchWithRules(cleanContent, this.rules[detectedLanguage]);
        if (result) results.push({ ...result, language: detectedLanguage, priority: 1 });
      }
      
      // 2. Try English rules as fallback
      if (detectedLanguage !== CONFIG.LANGUAGES.ENGLISH) {
        const result = this.matchWithRules(cleanContent, this.rules[CONFIG.LANGUAGES.ENGLISH]);
        if (result) results.push({ ...result, language: CONFIG.LANGUAGES.ENGLISH, priority: 2 });
      }
      
      // 3. Try universal number patterns
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
   * Clean email content
   */
  cleanContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\d：:]/g, '')
      .trim();
  }

  /**
   * Detect language from content
   */
  detectLanguage(content) {
    const patterns = {
      [CONFIG.LANGUAGES.CHINESE]: /[\u4e00-\u9fff]/,
      [CONFIG.LANGUAGES.SPANISH]: /[ñáéíóúü]/i,
      [CONFIG.LANGUAGES.ITALIAN]: /[àèéìíîòóù]/i
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) return lang;
    }
    
    return CONFIG.LANGUAGES.ENGLISH;
  }

  /**
   * Match content with rules
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
   * Calculate confidence score
   */
  calculateConfidence(content, otp, rules) {
    let confidence = 0.5;
    
    // Keyword matching bonus
    const keywordMatches = rules.keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    confidence += keywordMatches * 0.1;
    
    // Context matching bonus
    const contextMatches = rules.contexts.filter(context => 
      content.toLowerCase().includes(context.toLowerCase())
    ).length;
    confidence += contextMatches * 0.15;
    
    // OTP length scoring
    if (otp.length === 6) confidence += 0.2;
    else if (otp.length === 4) confidence += 0.15;
    else if (otp.length >= CONFIG.OTP.MIN_LENGTH && otp.length <= CONFIG.OTP.MAX_LENGTH) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Select best result from multiple matches
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
   * Validate OTP format
   */
  isValidOTP(otp) {
    if (!otp || typeof otp !== 'string') return false;
    if (!/^\d+$/.test(otp)) return false;
    if (otp.length < CONFIG.OTP.MIN_LENGTH || otp.length > CONFIG.OTP.MAX_LENGTH) return false;
    return true;
  }
}
