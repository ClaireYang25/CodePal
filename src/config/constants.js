/**
 * Gmail OTP AutoFill - Configuration Constants
 * Centralized configuration to avoid hard-coding
 */

export const CONFIG = {
  // Extension metadata
  EXTENSION_NAME: 'Gmail OTP AutoFill',
  VERSION: '1.0.0',
  
  // Storage keys
  STORAGE_KEYS: {
    GEMINI_API_KEY: 'geminiApiKey',
    LATEST_OTP: 'latestOTP',
    POPUP_SETTINGS: 'popupSettings'
  },
  
  // API Configuration
  API: {
    GEMINI: {
      BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
      MODEL: 'gemini-1.5-flash',
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000,
      TEMPERATURE: 0.1,
      TOP_K: 1,
      TOP_P: 0.8,
      MAX_OUTPUT_TOKENS: 500
    }
  },
  
  // OTP Configuration
  OTP: {
    MIN_LENGTH: 4,
    MAX_LENGTH: 8,
    CONFIDENCE_THRESHOLD: 0.8,
    EXPIRY_TIME: 5 * 60 * 1000, // 5 minutes in milliseconds
    CONTEXT_LENGTH: 200 // characters to store with OTP
  },
  
  // Offscreen Document
  OFFSCREEN: {
    PATH: 'src/offscreen/offscreen.html',
    INIT_DELAY: 100 // milliseconds
  },
  
  // UI Configuration
  UI: {
    NOTIFICATION: {
      DURATION: 3000, // milliseconds
      POSITION: { top: '20px', right: '20px' }
    },
    POPUP: {
      WIDTH: '350px',
      MIN_HEIGHT: '400px'
    }
  },
  
  // Supported Languages
  LANGUAGES: {
    CHINESE: 'zh',
    ENGLISH: 'en',
    SPANISH: 'es',
    ITALIAN: 'it',
    AUTO: 'auto'
  },
  
  // Action Types for Message Passing
  ACTIONS: {
    EXTRACT_OTP: 'extractOTP',
    FILL_OTP: 'fillOTP', // Added for autofill requests
    TEST_GEMINI_NANO: 'testGeminiNano',
    TEST_GEMINI_API: 'testGeminiAPI',
    OFFSCREEN_EXTRACT_OTP: 'offscreen-extractOTP',
    OFFSCREEN_TEST_CONNECTION: 'offscreen-testConnection'
  },
  
  // Prompt Templates
  PROMPTS: {
    INSTRUCTIONS: {
      zh: 'This is a Chinese email, identify keywords like "验证码" (verification code).',
      en: 'This is an English email, identify "verification code", "OTP", "PIN".',
      es: 'This is a Spanish email, identify "código de verificación".',
      it: 'This is an Italian email, identify "codice di verifica".',
      auto: 'Auto-detect the language and identify the verification code.'
    }
  }
};

/**
 * Build OTP extraction prompt
 * @param {string} emailContent - Email content
 * @param {string} language - Language code
 * @returns {string} Formatted prompt
 */
export function buildOTPPrompt(emailContent, language = CONFIG.LANGUAGES.AUTO) {
  const instruction = CONFIG.PROMPTS.INSTRUCTIONS[language] || CONFIG.PROMPTS.INSTRUCTIONS.auto;
  
  return `You are a verification code extraction assistant. Extract the one-time password (OTP) from the email.

${instruction}

Email content:
"""
${emailContent}
"""

Return in JSON format:
{
  "otp": "verification code (${CONFIG.OTP.MIN_LENGTH}-${CONFIG.OTP.MAX_LENGTH} digits)",
  "confidence": 0.95,
  "reasoning": "extraction reasoning"
}

Rules:
1. Only extract ${CONFIG.OTP.MIN_LENGTH}-${CONFIG.OTP.MAX_LENGTH} digit codes
2. Set otp to null if not found
3. Return JSON only, no other content

JSON:`;
}

