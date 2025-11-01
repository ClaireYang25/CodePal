/**
 * CodePal - OTP Recognition Engine
 * Implements local, regex-based OTP extraction as the first tier of the engine.
 * This approach is fast, private, and covers a high percentage of common OTP formats.
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
          /verification\s+code\s*[：:is\s]+(\d{4,8})/i,
          /your\s+(?:verification\s+)?code\s*[：:is\s]+(\d{4,8})/i,
          /code\s*[：:is\s]+(\d{4,8})/i,
          /otp\s*[：:is\s]+(\d{4,8})/i,
          /pin\s*[：:is\s]+(\d{4,8})/i,
          /(\d{4,8})\s+is\s+your\s+(?:verification\s+)?code/i,
          /(\d{6})\s+(?:verification\s+)?code/i,
          /use\s+code\s+(\d{4,8})/i,
          /security\s+code\s*[：:is\s]+(\d{4,8})/i
        ],
        keywords: ['verification', 'code', 'otp', 'pin', 'token', 'security'],
        contexts: ['login', 'signup', 'security', 'authentication', 'verify']
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
  async extractOTP(content, language) {
    try {
      // The service worker now detects the language.
      // We directly use the provided language for rule selection.
      const detectedLanguage = language;
      
      const results = [];
      
      // 1. Try specific language rules
      if (this.rules[detectedLanguage]) {
        const result = this.matchWithRules(content, this.rules[detectedLanguage]);
        if (result) results.push({ ...result, language: detectedLanguage, priority: 1 });
      }
      
      // 2. Try English rules as fallback
      if (detectedLanguage !== CONFIG.LANGUAGES.ENGLISH) {
        const result = this.matchWithRules(content, this.rules[CONFIG.LANGUAGES.ENGLISH]);
        if (result) results.push({ ...result, language: CONFIG.LANGUAGES.ENGLISH, priority: 2 });
      }
      
      // 3. Try universal number patterns
      const universalResult = this.matchWithRules(content, this.rules.universal);
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
   * Normalizes whitespace in the content for easier regex matching.
   * Marked as private by convention.
   */
  _normalizeWhitespace(content) {
    return content.replace(/\s+/g, ' ').trim();
  }

  /**
   * Match content with rules
   */
  matchWithRules(content, rules) {
    const normalizedContent = this._normalizeWhitespace(content);
    let bestMatch = null;
    let highestConfidence = 0;

    for (const pattern of rules.patterns) {
      const matches = normalizedContent.match(pattern);
      if (matches && matches[1]) {
        const otp = matches[1];
        const confidence = this.calculateConfidence(normalizedContent, otp, rules);
        
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
}
