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
   * Extract OTP using three-tier intelligent engine:
   * 1️⃣ Local regex matching (< 50ms, 90%+ coverage)
   * 2️⃣ Gemini Nano (Chrome Prompt API, on-device)
   * 3️⃣ Gemini API (cloud fallback)
   */
  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // Tier 1: Local regex matching - Fast & Private
      const localResult = await this.otpEngine.extractOTP(emailContent, language);
      
      // Lowered confidence threshold for aggressive local-first strategy
      if (localResult.success && localResult.confidence > 0.6) {
        console.log(`✅ OTP found via local regex (confidence: ${localResult.confidence})`);
        sendResponse(localResult);
        return;
      }

      console.log(`⚠️ Local regex confidence low (${localResult.confidence}), trying Gemini Nano...`);

      // Tier 2: Gemini Nano (via offscreen document)
      try {
        const nanoResult = await this.callOffscreenDocument({
          action: CONFIG.ACTIONS.OFFSCREEN_EXTRACT_OTP,
          emailContent,
          language
        });
        
        if (nanoResult?.success) {
          console.log('✅ OTP found via Gemini Nano');
          sendResponse(nanoResult);
          return;
        }
      } catch (error) {
        console.warn('⚠️ Gemini Nano failed, trying API fallback:', error.message);
      }

      // Tier 3: Gemini API (cloud fallback)
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
   */
  async handleTestGeminiNano(sendResponse) {
    try {
      const result = await this.callOffscreenDocument({ 
        action: CONFIG.ACTIONS.OFFSCREEN_TEST_CONNECTION
      });
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
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

  /**
   * Call offscreen document for Gemini Nano processing
   */
  async callOffscreenDocument(message) {
    try {
      // Check if offscreen API is available
      if (!chrome.offscreen) {
        throw new Error('Offscreen API not available in this Chrome version (requires Chrome 116+)');
      }

      const hasDocument = await chrome.offscreen.hasDocument();
      
      if (!hasDocument) {
        await chrome.offscreen.createDocument({
          url: CONFIG.OFFSCREEN.PATH,
          reasons: [chrome.offscreen.Reason.USER_MEDIA],
          justification: 'AI processing for OTP extraction using Gemini Nano.'
        });
        
        // Wait for document initialization
        await new Promise(resolve => setTimeout(resolve, CONFIG.OFFSCREEN.INIT_DELAY));
      }

      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Offscreen document error:', error);
      throw error;
    }
  }
}

// Initialize background service
new BackgroundService();
