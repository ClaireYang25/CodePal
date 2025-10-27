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
    GMAIL_TOKEN: 'gmailToken',
    GEMINI_API_KEY: 'geminiApiKey',
    LATEST_OTP: 'latestOTP',
    POPUP_SETTINGS: 'popupSettings',
    AI_USAGE_STATS: 'aiUsageStats'
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
    },
    GMAIL: {
      BASE_URL: 'https://gmail.googleapis.com/gmail/v1',
      DEFAULT_LIMIT: 10
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
    AUTHENTICATE: 'authenticate',
    GET_LATEST_EMAILS: 'getLatestEmails',
    EXTRACT_OTP: 'extractOTP',
    CHECK_AUTH_STATUS: 'checkAuthStatus',
    TEST_GEMINI_NANO: 'testGeminiNano',
    TEST_GEMINI_API: 'testGeminiAPI',
    FILL_OTP: 'fillOTP',
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
    },
    TEST_CONNECTION: 'Please respond with "Connection successful"'
  },
  
  // Gmail Selectors (for content script)
  GMAIL_SELECTORS: {
    MAIN_CONTAINER: '[role="main"]',
    THREAD: '[data-thread-id]',
    MESSAGE_ID: '[data-message-id]',
    EMAIL_PREVIEW: '.y2',
    EMAIL_BODY: '.yP',
    THREAD_SNIPPET: '.thread-snippet'
  },
  
  // OTP Input Field Keywords
  OTP_KEYWORDS: [
    'otp', 'verification', 'code', 'token', 'pin',
    'verify', 'auth', 'security', 'confirm'
  ],
  
  // Debounce Delays
  DELAYS: {
    EMAIL_CHANGE: 1000,
    EMAIL_CLICK: 1000
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

/**
 * Get language instruction for a specific language
 * @param {string} language - Language code
 * @returns {string} Instruction text
 */
export function getLanguageInstruction(language) {
  return CONFIG.PROMPTS.INSTRUCTIONS[language] || CONFIG.PROMPTS.INSTRUCTIONS.auto;
}

