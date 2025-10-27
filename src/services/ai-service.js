/**
 * AI Service - Gemini API
 * Cloud-based AI service as fallback for Gemini Nano
 */

import { CONFIG, buildOTPPrompt } from '../config/constants.js';

export class AIService {
  constructor() {
    this.apiKey = null;
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
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.GEMINI_API_KEY], (result) => {
        resolve(result[CONFIG.STORAGE_KEYS.GEMINI_API_KEY]);
      });
    });
  }

  async setAPIKey(apiKey) {
    this.apiKey = apiKey;
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        [CONFIG.STORAGE_KEYS.GEMINI_API_KEY]: apiKey 
      }, resolve);
    });
  }

  /**
   * Extract OTP using Gemini API
   * @param {string} emailContent - Email content
   * @param {string} language - Language code
   * @returns {Promise<Object>} Extraction result
   */
  async extractOTP(emailContent, language = CONFIG.LANGUAGES.AUTO) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured.');
    }

    const prompt = buildOTPPrompt(emailContent, language);
    const response = await this.callAPI(prompt);
    return this.parseResponse(response);
  }

  /**
   * Call Gemini API with retry mechanism
   */
  async callAPI(prompt) {
    const url = `${CONFIG.API.GEMINI.BASE_URL}/models/${CONFIG.API.GEMINI.MODEL}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: CONFIG.API.GEMINI.TEMPERATURE,
        topK: CONFIG.API.GEMINI.TOP_K,
        topP: CONFIG.API.GEMINI.TOP_P,
        maxOutputTokens: CONFIG.API.GEMINI.MAX_OUTPUT_TOKENS
      }
    };

    for (let attempt = 1; attempt <= CONFIG.API.GEMINI.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          if (response.status === 429 && attempt < CONFIG.API.GEMINI.MAX_RETRIES) {
            // Rate limit, wait and retry
            await this.delay(CONFIG.API.GEMINI.RETRY_DELAY * attempt);
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
        if (attempt === CONFIG.API.GEMINI.MAX_RETRIES) throw error;
        await this.delay(CONFIG.API.GEMINI.RETRY_DELAY * attempt);
      }
    }
  }

  /**
   * Parse API response
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
   * Test API connection
   */
  async testConnection() {
    if (!this.apiKey) {
      return { success: false, error: 'API key not configured' };
    }
    
    try {
      const response = await this.callAPI(CONFIG.PROMPTS.TEST_CONNECTION);
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text && text.toLowerCase().includes('success')) {
        return { 
          success: true, 
          message: 'Gemini API connected',
          model: CONFIG.API.GEMINI.MODEL
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
