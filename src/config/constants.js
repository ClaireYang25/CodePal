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
    OFFSCREEN_TEST_CONNECTION: 'offscreen-testConnection',
    OTP_INTENT_SIGNAL: 'otpIntentSignal'
  },

  HIGH_ALERT: {
    WINDOW_MS: 2 * 60 * 1000 // stay in high-alert mode for 2 minutes
  },
  
  // Prompt Templates
  PROMPTS: {
    INSTRUCTIONS: {
      zh: '这是一封中文邮件，请识别“验证码”“安全码”“动态口令”等关键词。',
      en: 'This is an English email, identify keywords such as "verification code", "OTP", "PIN".',
      es: 'Este es un correo en español, identifica palabras clave como "código de verificación" y "OTP".',
      it: 'Questa è un e-mail in italiano, identifica parole chiave come "codice di verifica" e "OTP".',
      auto: 'Auto-detect the language and identify the verification code.'
    },
    POSITIVE_KEYWORDS: {
      zh: ['验证码', '动态码', '安全码', '校验码', '一次性密码'],
      en: ['verification code', 'otp', 'one-time password', 'security code', 'auth code', 'pin'],
      es: ['código de verificación', 'otp', 'código de seguridad', 'clave temporal'],
      it: ['codice di verifica', 'otp', 'codice di sicurezza', 'pin'],
      auto: ['verification code', 'otp', 'one-time password', 'security code', 'auth code', 'pin']
    },
    NEGATIVE_KEYWORDS: {
      zh: ['订单号', '预订号', '航班号', '票号', '交易号', '账号', '参考号', '预定号'],
      en: ['order number', 'booking', 'reservation', 'ticket', 'invoice', 'receipt', 'account number', 'tracking', 'reference number'],
      es: ['número de pedido', 'reserva', 'boleto', 'factura', 'recibo', 'número de cuenta', 'número de referencia'],
      it: ['numero d\'ordine', 'prenotazione', 'biglietto', 'fattura', 'ricevuta', 'numero di conto', 'numero di riferimento'],
      auto: ['order number', 'booking', 'reservation', 'ticket', 'invoice', 'receipt', 'account number', 'reference number']
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
  const positive = CONFIG.PROMPTS.POSITIVE_KEYWORDS[language] || CONFIG.PROMPTS.POSITIVE_KEYWORDS.auto;
  const negative = CONFIG.PROMPTS.NEGATIVE_KEYWORDS[language] || CONFIG.PROMPTS.NEGATIVE_KEYWORDS.auto;
  
  const positiveList = positive.map(item => `- ${item}`).join('\n');
  const negativeList = negative.map(item => `- ${item}`).join('\n');
  
  return `You are a verification code extraction assistant. Your goal is to return the true one-time password (OTP) from the email and avoid all irrelevant numbers.

${instruction}

Helpful cues (prioritize numbers surrounded by these words):
${positiveList}

Ignore numbers related to confirmation, purchases, or logistics. Common distractions include:
${negativeList}

If multiple numbers appear, compare their surrounding words and select the one explicitly described as a verification or security code. If you are uncertain, return null.

Email content:
"""
${emailContent}
"""

Return in JSON format:
{
  "otp": "${CONFIG.OTP.MIN_LENGTH}-${CONFIG.OTP.MAX_LENGTH} digit verification code or null",
  "confidence": 0.0,
  "reasoning": "Explain the nearby words that prove it is the OTP"
}

Rules:
1. Only return digits (${CONFIG.OTP.MIN_LENGTH}-${CONFIG.OTP.MAX_LENGTH} length). Do not invent characters.
2. Set otp to null if the email does not contain a clearly labeled verification code.
3. Confidence must be between 0 and 1 (float).
4. Reasoning must mention the exact words that guided your decision.
5. Return JSON only, no prose or markdown.

JSON:`;
}

