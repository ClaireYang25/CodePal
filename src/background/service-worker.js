/**
 * Gmail OTP AutoFill - Service Worker
 * Background service handling message routing and AI calls
 */

import { AIService } from '../services/ai-service.js';
import { OTPEngine } from '../core/otp-engine.js';
import { CONFIG } from '../config/constants.js';

class BackgroundService {
  constructor() {
    this.aiService = new AIService();
    this.otpEngine = new OTPEngine();
    this.init();
  }

  async init() {
    try {
      this.setupMessageListeners();
      console.log('✅ Background service initialized');
    } catch (error) {
      console.error('❌ Background initialization failed:', error);
    }
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  /**
   * Handle message routing
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      const handlers = {
        [CONFIG.ACTIONS.EXTRACT_OTP]: () => this.handleExtractOTP(request, sendResponse),
        [CONFIG.ACTIONS.TEST_GEMINI_NANO]: () => this.handleTestGeminiNano(sendResponse),
        [CONFIG.ACTIONS.TEST_GEMINI_API]: () => this.handleTestGeminiAPI(sendResponse)
      };

      const handler = handlers[request.action];
      if (handler) {
        await handler();
      } else {
        sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Extract OTP using two-tier engine:
   * 1️⃣ Local regex matching (< 50ms, 90%+ coverage) - PRIMARY
   * 2️⃣ Gemini API (cloud fallback) - if configured
   * 
   * Note: Gemini Nano integration is simplified for now.
   * It can be added later in popup.js if needed.
   */
  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // Validate content before processing
      if (!emailContent || emailContent.trim().length < 10) {
        console.warn('⚠️ Invalid or empty email content, skipping');
        sendResponse({ 
          success: false, 
          error: 'Email content is empty or too short' 
        });
        return;
      }
      
      // Tier 1: Local regex matching - Fast & Private
      const localResult = await this.otpEngine.extractOTP(emailContent, language);
      
      // Lowered confidence threshold for aggressive local-first strategy
      if (localResult.success && localResult.confidence > 0.5) {
        console.log(`✅ OTP found via local regex (confidence: ${localResult.confidence})`);
        sendResponse(localResult);
        return;
      }

      console.log(`⚠️ Local regex confidence low (${localResult.confidence}), trying Gemini API fallback...`);

      // Tier 2: Gemini API (cloud fallback) - if API key is configured
      try {
        const apiResult = await this.aiService.extractOTP(emailContent, language);
        console.log('✅ OTP found via Gemini API');
        sendResponse(apiResult);
      } catch (error) {
        console.error('❌ All OTP extraction methods failed');
        sendResponse({ 
          success: false, 
          error: 'Failed to extract OTP. Please try manually.',
          details: error.message
        });
      }
      
    } catch (error) {
      console.error('❌ OTP extraction failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Test Gemini Nano
   * Note: Gemini Nano test is handled in popup.js directly
   * since Prompt API requires a window context
   */
  async handleTestGeminiNano(sendResponse) {
    sendResponse({ 
      success: false, 
      error: 'Gemini Nano test should be initiated from popup (requires window context)' 
    });
  }

  /**
   * Test Gemini API
   */
  async handleTestGeminiAPI(sendResponse) {
    try {
      const result = await this.aiService.testConnection();
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize background service
new BackgroundService();
