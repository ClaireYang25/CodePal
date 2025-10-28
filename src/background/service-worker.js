/**
 * Gmail OTP AutoFill - Service Worker
 * Core background service implementing three-tier intelligent OTP extraction engine:
 * 1. Local Regex (fast, private, 90%+ coverage)
 * 2. Gemini Nano (on-device AI, via offscreen document)
 * 3. Gemini API (cloud fallback, requires configuration)
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
      console.log('🎯 Three-tier engine ready: Regex → Nano → Cloud API');
    } catch (error) {
      console.error('❌ Background initialization failed:', error);
    }
  }

  /**
   * Setup message listeners
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Ignore messages meant for offscreen document
      if (request.target === 'offscreen') {
        return false; // Not handling this message
      }
      
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async
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
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Main OTP extraction workflow.
   * This is the entry point for the three-tier engine.
   */
  async handleExtractOTP(request, sendResponse) {
    const { emailContent } = request;
    const language = this.detectLanguage(emailContent);
    let result = { success: false, confidence: 0 };

    console.log(`🔍 Starting three-tier OTP extraction for email (lang: ${language})...`);

    // Tier 1: Regex - Fast and local
    result = await this._tryRegex(emailContent, language);
    if (result.success) {
      console.log(`✅ OTP found via LOCAL REGEX (confidence: ${result.confidence})`);
      await this.processSuccess(result);
      return sendResponse(result);
    }

    // Tier 2: Gemini Nano - Private and on-device AI
    result = await this._tryNano(emailContent, language);
    if (result.success) {
      console.log(`✅ OTP found via GEMINI NANO (confidence: ${result.confidence})`);
      await this.processSuccess(result);
      return sendResponse(result);
    }
    
    // Tier 3: Gemini API - Powerful cloud fallback
    result = await this._tryApi(emailContent, language);
    if (result.success) {
      console.log(`✅ OTP found via GEMINI API (cloud)`);
      await this.processSuccess(result);
      return sendResponse(result);
    }

    console.error('❌ All three tiers failed to extract OTP.');
    sendResponse({ success: false, error: 'All extraction methods failed.' });
  }

  async _tryRegex(content, language) {
    console.log('1️⃣ Tier 1: Trying local regex...');
    const result = await this.otpEngine.extractOTP(content, language);
    if (result.success && result.confidence > 0.5) {
      return result;
    }
    console.log(`⚠️ Regex confidence low (${result.confidence}), moving to next tier.`);
    return { success: false };
  }

  async _tryNano(content, language) {
    console.log('2️⃣ Tier 2: Trying Gemini Nano...');
    try {
      const nanoResult = await this.callOffscreenNano({
        action: CONFIG.ACTIONS.OFFSCREEN_EXTRACT_OTP,
        emailContent: content,
        language
      });
      console.log('📥 Nano returned:', JSON.stringify(nanoResult));
      if (nanoResult?.success) {
        return nanoResult;
      }
    } catch (error) {
      console.error('⚠️ Gemini Nano EXCEPTION:', error.message);
    }
    console.log('⚠️ Nano failed or unconfident, moving to next tier.');
    return { success: false };
  }

  async _tryApi(content, language) {
    console.log('3️⃣ Tier 3: Trying Gemini API (cloud)...');
    try {
      const apiResult = await this.aiService.extractOTP(content, language);
      if (apiResult.success) {
        return apiResult;
      }
    } catch (error) {
      console.error('⚠️ Gemini API EXCEPTION:', error.message);
    }
    return { success: false };
  }

  /**
   * Centralized success handler.
   */
  async processSuccess(result) {
    await this.storeOTPResult(result);
    this.notifyPopupOfUpdate();
    this.requestAutofill(result.otp);
  }
  
  /**
   * Detects language from text content.
   */
  detectLanguage(text) {
    // Basic language detection, can be expanded
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
    if (/[ñáéíóúü]/.test(text)) return 'es';
    if (/[àèéìíòóù]/.test(text)) return 'it';
    return 'en';
  }

  /**
   * Store OTP result and notify UI components.
   */
  async storeOTPResult(result) {
    if (result.success && result.otp) {
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.LATEST_OTP]: {
          otp: result.otp,
          timestamp: Date.now(),
          method: result.method || 'unknown',
          confidence: result.confidence
        }
      });
    }
  }

  /**
   * Request the content script to perform autofill.
   */
  async requestAutofill(otp) {
    try {
      const tabs = await chrome.tabs.query({ url: "*://mail.google.com/*" });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: CONFIG.ACTIONS.FILL_OTP,
            otp
          });
          console.log(`📬 Sent autofill request to tab ${tab.id}`);
        } catch (err) {
          // If content script is not present on the tab, ignore
          if (!String(err?.message || '').includes('Receiving end does not exist')) {
            console.warn(`Autofill message to tab ${tab.id} failed:`, err?.message || err);
          }
        }
      }
    } catch (error) {
      console.error('Autofill broadcast failed:', error.message);
    }
  }

  /**
   * Send a message to the popup (if open) to notify it of an update.
   */
  notifyPopupOfUpdate() {
    chrome.runtime.sendMessage({ action: 'otpUpdated' }).catch(err => {
      // Ignore errors, popup is likely just not open
    });
  }

  /**
   * Create and communicate with Offscreen Document for Gemini Nano
   */
  async callOffscreenNano(message) {
    try {
      // Check if offscreen API is available
      if (!chrome.offscreen) {
        throw new Error('Offscreen API not available (requires Chrome 116+)');
      }

      // Create offscreen document if not exists
      const hasDocument = await chrome.offscreen.hasDocument();
      
      if (!hasDocument) {
        console.log('📄 Creating offscreen document for Nano...');
        
        await chrome.offscreen.createDocument({
          url: CONFIG.OFFSCREEN.PATH,
          reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
          justification: 'Required for Gemini Nano execution (needs window context)'
        });
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, CONFIG.OFFSCREEN.INIT_DELAY));
        console.log('✅ Offscreen document created');
      }

      // Send message to offscreen document
      // Add a target flag to ensure only offscreen document processes it
      const targetedMessage = { ...message, target: 'offscreen' };
      const response = await chrome.runtime.sendMessage(targetedMessage);
      return response;

    } catch (error) {
      console.error('❌ Offscreen document error:', error);
      throw error;
    }
  }

  /**
   * Test Gemini Nano (via offscreen document)
   */
  async handleTestGeminiNano(sendResponse) {
    try {
      console.log('🧪 Testing Gemini Nano status...');
      const result = await this.callOffscreenNano({
        action: CONFIG.ACTIONS.OFFSCREEN_TEST_CONNECTION
      });


      console.log('🧪 Nano test result:', JSON.stringify(result, null, 2));
      console.log('🧪 Result breakdown:', {
        success: result.success,
        status: result.status,
        message: result.message,
        progress: result.progress,
        error: result.error
      });
      sendResponse(result);
      
    } catch (error) {
      console.error('❌ Nano test failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Test Gemini API (cloud)
   */
  async handleTestGeminiAPI(sendResponse) {
    try {
      console.log('🧪 Testing Gemini API...');
      
      const result = await this.aiService.testConnection();
      sendResponse(result);
      
    } catch (error) {
      console.error('❌ API test failed:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Cleanup offscreen document when needed
   */
  async cleanupOffscreen() {
    if (chrome.offscreen && await chrome.offscreen.hasDocument()) {
      try {
        await chrome.offscreen.closeDocument();
        console.log('🗑️ Offscreen document closed');
      } catch (error) {
        console.warn('Failed to close offscreen document:', error);
      }
    }
  }
}

// Initialize background service
new BackgroundService();

console.log('🚀 Gmail OTP AutoFill - Service Worker Active');
console.log('📊 Architecture: Content Script → Service Worker → [Regex | Nano | API]');
