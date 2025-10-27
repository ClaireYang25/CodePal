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
    this.offscreenCreated = false;
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
   * THREE-TIER INTELLIGENT OTP EXTRACTION ENGINE
   * 
   * Tier 1: Local Regex (< 50ms, privacy-first)
   * Tier 2: Gemini Nano (on-device, no network)
   * Tier 3: Gemini API (cloud, requires key)
   */
  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // Validate content
      if (!emailContent || emailContent.trim().length < 10) {
        console.warn('⚠️ Email content too short, skipping');
        sendResponse({ 
          success: false, 
          error: 'Email content is empty or too short' 
        });
        return;
      }

      console.log('🔍 Starting three-tier OTP extraction...');

      // ============================================
      // TIER 1: LOCAL REGEX MATCHING
      // ============================================
      console.log('1️⃣ Tier 1: Trying local regex...');
      const regexResult = await this.otpEngine.extractOTP(emailContent, language);
      
      // Success if confidence > 0.5 (lowered threshold for aggressive local-first)
      if (regexResult.success && regexResult.confidence > 0.5) {
        console.log(`✅ OTP found via LOCAL REGEX (confidence: ${regexResult.confidence})`);
        sendResponse(regexResult);
        return;
      }

      console.log(`⚠️ Regex confidence low (${regexResult.confidence}), moving to Tier 2...`);

      // ============================================
      // TIER 2: GEMINI NANO (ON-DEVICE AI)
      // ============================================
      console.log('2️⃣ Tier 2: Trying Gemini Nano...');
      
      try {
        const nanoResult = await this.callOffscreenNano({
          action: CONFIG.ACTIONS.OFFSCREEN_EXTRACT_OTP,
          emailContent,
          language
        });
        
        console.log('📥 Nano returned:', JSON.stringify(nanoResult));
        
        if (nanoResult?.success) {
          console.log(`✅ OTP found via GEMINI NANO (confidence: ${nanoResult.confidence})`);
          sendResponse(nanoResult);
          return;
        }

        console.log('⚠️ Nano failed or returned low confidence, moving to Tier 3...');
        
      } catch (error) {
        console.error('⚠️ Gemini Nano EXCEPTION:', error);
        console.log('Moving to Tier 3 (Cloud API)...');
      }

      // ============================================
      // TIER 3: GEMINI API (CLOUD FALLBACK)
      // ============================================
      console.log('3️⃣ Tier 3: Trying Gemini API (cloud)...');
      
      try {
        const apiResult = await this.aiService.extractOTP(emailContent, language);
        console.log('✅ OTP found via GEMINI API (cloud)');
        sendResponse(apiResult);
        return;
        
      } catch (error) {
        console.error('❌ All three tiers failed');
        sendResponse({ 
          success: false, 
          error: 'Failed to extract OTP. Please check manually.',
          details: {
            regex: `confidence ${regexResult.confidence}`,
            nano: 'failed or unavailable',
            api: error.message
          }
        });
      }
      
    } catch (error) {
      console.error('❌ OTP extraction error:', error);
      sendResponse({ success: false, error: error.message });
    }
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
          reasons: [chrome.offscreen.Reason.USER_MEDIA],
          justification: 'Required for Gemini Nano execution (needs window context)'
        });
        
        this.offscreenCreated = true;
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, CONFIG.OFFSCREEN.INIT_DELAY));
        console.log('✅ Offscreen document created');
      }

      // Send message to offscreen document
      const response = await chrome.runtime.sendMessage(message);
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
      console.log('🧪 Testing Gemini Nano...');
      
      const result = await this.callOffscreenNano({
        action: CONFIG.ACTIONS.OFFSCREEN_TEST_CONNECTION
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
    if (this.offscreenCreated && chrome.offscreen) {
      try {
        await chrome.offscreen.closeDocument();
        this.offscreenCreated = false;
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
