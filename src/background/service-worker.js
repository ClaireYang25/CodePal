/**
 * Gmail OTP AutoFill - Service Worker
 * Background service handling authentication, message routing, and AI calls
 */

import { AIService } from '../services/ai-service.js';
import { GmailService } from '../services/gmail-service.js';
import { OTPEngine } from '../core/otp-engine.js';
import { CONFIG } from '../config/constants.js';

class BackgroundService {
  constructor() {
    this.gmailService = null;
    this.aiService = new AIService();
    this.otpEngine = new OTPEngine();
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    try {
      await this.checkAuthentication();
      this.setupMessageListeners();
      console.log('✅ Background service initialized');
    } catch (error) {
      console.error('❌ Background initialization failed:', error);
    }
  }

  /**
   * Check Gmail authentication status
   */
  async checkAuthentication() {
    const token = await this.getStoredToken();
    if (token) {
      this.isAuthenticated = true;
      this.gmailService = new GmailService(token);
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
        [CONFIG.ACTIONS.AUTHENTICATE]: () => this.handleAuthentication(sendResponse),
        [CONFIG.ACTIONS.GET_LATEST_EMAILS]: () => this.handleGetLatestEmails(request, sendResponse),
        [CONFIG.ACTIONS.EXTRACT_OTP]: () => this.handleExtractOTP(request, sendResponse),
        [CONFIG.ACTIONS.CHECK_AUTH_STATUS]: () => sendResponse({ authenticated: this.isAuthenticated }),
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
   * Handle Gmail authentication
   */
  async handleAuthentication(sendResponse) {
    try {
      const token = await this.authenticateWithGoogle();
      await this.storeToken(token);
      this.isAuthenticated = true;
      this.gmailService = new GmailService(token);
      sendResponse({ success: true, token });
    } catch (error) {
      console.error('Authentication failed:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Google OAuth authentication
   */
  async authenticateWithGoogle() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('No token received'));
        }
      });
    });
  }

  /**
   * Get latest emails
   */
  async handleGetLatestEmails(request, sendResponse) {
    if (!this.isAuthenticated) {
      sendResponse({ error: 'Not authenticated' });
      return;
    }

    try {
      const limit = request.limit || CONFIG.API.GMAIL.DEFAULT_LIMIT;
      const emails = await this.gmailService.getLatestEmails(limit);
      sendResponse({ success: true, emails });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  /**
   * Extract OTP using three-tier intelligent engine:
   * 1️⃣ Local regex matching
   * 2️⃣ Gemini Nano (Chrome Prompt API)
   * 3️⃣ Gemini API (cloud fallback)
   */
  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // Tier 1: Local regex matching
      const localResult = await this.otpEngine.extractOTP(emailContent, language);
      
      if (localResult.success && localResult.confidence > CONFIG.OTP.CONFIDENCE_THRESHOLD) {
        console.log('✅ OTP found via local regex');
        sendResponse(localResult);
        return;
      }

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
      const apiResult = await this.aiService.extractOTP(emailContent, language);
      console.log('✅ OTP found via Gemini API');
      sendResponse(apiResult);
      
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

  /**
   * Store and retrieve authentication token
   */
  async storeToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        [CONFIG.STORAGE_KEYS.GMAIL_TOKEN]: token 
      }, resolve);
    });
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.GMAIL_TOKEN], (result) => {
        resolve(result[CONFIG.STORAGE_KEYS.GMAIL_TOKEN]);
      });
    });
  }
}

// Initialize background service
new BackgroundService();
