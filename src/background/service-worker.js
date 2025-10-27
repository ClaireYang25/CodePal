/**
 * Gmail OTP AutoFill - Service Worker
 * 后台服务，处理认证、消息路由和 AI 调用
 */

import { AIService } from '../services/ai-service.js';
import { GmailService } from '../services/gmail-service.js';
import { OTPEngine } from '../core/otp-engine.js';

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
   * 检查 Gmail 认证状态
   */
  async checkAuthentication() {
    const token = await this.getStoredToken();
    if (token) {
      this.isAuthenticated = true;
      this.gmailService = new GmailService(token);
    }
  }

  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  /**
   * 处理消息路由
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      const handlers = {
        'authenticate': () => this.handleAuthentication(sendResponse),
        'getLatestEmails': () => this.handleGetLatestEmails(request, sendResponse),
        'extractOTP': () => this.handleExtractOTP(request, sendResponse),
        'checkAuthStatus': () => sendResponse({ authenticated: this.isAuthenticated }),
        'testGeminiNano': () => this.handleTestGeminiNano(sendResponse),
        'testGeminiAPI': () => this.handleTestGeminiAPI(sendResponse)
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
   * 处理 Gmail 认证
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
   * Google OAuth 认证
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
   * 获取最新邮件
   */
  async handleGetLatestEmails(request, sendResponse) {
    if (!this.isAuthenticated) {
      sendResponse({ error: 'Not authenticated' });
      return;
    }

    try {
      const emails = await this.gmailService.getLatestEmails(request.limit || 10);
      sendResponse({ success: true, emails });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  /**
   * 提取 OTP - 三层智能引擎
   * 1️⃣ 本地正则匹配
   * 2️⃣ Gemini Nano (Chrome Prompt API)
   * 3️⃣ Gemini API (云端备用)
   */
  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // 第一层：本地正则匹配
      const localResult = await this.otpEngine.extractOTP(emailContent, language);
      
      if (localResult.success && localResult.confidence > 0.8) {
        console.log('✅ OTP found via local regex');
        sendResponse(localResult);
        return;
      }

      // 第二层：Gemini Nano (通过 offscreen 文档)
      try {
        const nanoResult = await this.callOffscreenDocument({
          action: 'offscreen-extractOTP',
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

      // 第三层：Gemini API (云端备用)
      const apiResult = await this.aiService.extractOTP(emailContent, language);
      console.log('✅ OTP found via Gemini API');
      sendResponse(apiResult);
      
    } catch (error) {
      console.error('❌ OTP extraction failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 测试 Gemini Nano
   */
  async handleTestGeminiNano(sendResponse) {
    try {
      const result = await this.callOffscreenDocument({ 
        action: 'offscreen-testConnection' 
      });
      sendResponse(result);
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 测试 Gemini API
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
   * 调用 Offscreen 文档
   */
  async callOffscreenDocument(message) {
    try {
      const hasDocument = await chrome.offscreen.hasDocument();
      
      if (!hasDocument) {
        await chrome.offscreen.createDocument({
          url: 'src/offscreen/offscreen.html',
          reasons: [chrome.offscreen.Reason.USER_MEDIA],
          justification: 'AI processing for OTP extraction using Gemini Nano.'
        });
        
        // 等待文档初始化
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Offscreen document error:', error);
      throw error;
    }
  }

  /**
   * 存储和获取 token
   */
  async storeToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ gmailToken: token }, resolve);
    });
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['gmailToken'], (result) => {
        resolve(result.gmailToken);
      });
    });
  }
}

// 初始化后台服务
new BackgroundService();

