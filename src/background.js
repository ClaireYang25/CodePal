import { AIService } from './ai-service.js';
import { OTPEngine } from './otp-engine.js';

/**
 * Gmail OTP AutoFill - Background Service Worker
 * 处理 Gmail API 认证、消息监听和 AI 服务调用
 */

class GmailOTPBackground {
  constructor() {
    this.gmailAPI = null;
    this.aiService = null;
    this.isAuthenticated = false;
    this.init();
  }

  async init() {
    try {
      await this.setupGmailAPI();
      await this.setupAIService();
      this.setupMessageListeners();
      console.log('Gmail OTP Background initialized');
    } catch (error) {
      console.error('Background initialization failed:', error);
    }
  }

  async setupGmailAPI() {
    // 检查是否已认证
    const token = await this.getStoredToken();
    if (token) {
      this.isAuthenticated = true;
      this.gmailAPI = new GmailAPIService(token);
    }
  }

  async setupAIService() {
    this.aiService = new AIService();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'authenticate':
          await this.handleAuthentication(sendResponse);
          break;
        case 'getLatestEmails':
          await this.handleGetLatestEmails(request, sendResponse);
          break;
        case 'extractOTP':
          await this.handleExtractOTP(request, sendResponse);
          break;
        case 'checkAuthStatus':
          sendResponse({ authenticated: this.isAuthenticated });
          break;
        case 'testChromePromptAPI':
          await this.handleTestChromePromptAPI(sendResponse);
          break;
        case 'requestPromptAPIPermissions':
          await this.handleRequestPromptAPIPermissions(sendResponse);
          break;
        case 'checkPromptAPIStatus':
          await this.handleCheckPromptAPIStatus(sendResponse);
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleAuthentication(sendResponse) {
    try {
      const token = await this.authenticateWithGoogle();
      await this.storeToken(token);
      this.isAuthenticated = true;
      this.gmailAPI = new GmailAPIService(token);
      sendResponse({ success: true, token });
    } catch (error) {
      console.error('Authentication failed:', error);
      sendResponse({ error: error.message });
    }
  }

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

  async handleGetLatestEmails(request, sendResponse) {
    if (!this.isAuthenticated) {
      sendResponse({ error: 'Not authenticated' });
      return;
    }

    try {
      const emails = await this.gmailAPI.getLatestEmails(request.limit || 10);
      sendResponse({ success: true, emails });
    } catch (error) {
      console.error('Failed to get emails:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleExtractOTP(request, sendResponse) {
    try {
      const { emailContent, language } = request;
      
      // 首先尝试本地规则匹配
      const localResult = await this.extractOTPLocal(emailContent, language);
      
      if (localResult.confidence > 0.8) {
        sendResponse({ success: true, otp: localResult.otp, method: 'local' });
        return;
      }

      // 如果本地匹配置信度不够，尝试使用 Chrome Prompt API (Gemini Nano)
      try {
        const promptResult = await sendMessageToOffscreen({
          action: 'offscreen-extractOTP',
          emailContent,
          language
        });
        
        if (promptResult && promptResult.success) {
          sendResponse(promptResult);
          return;
        }
        console.warn('Chrome Prompt API failed, falling back to Gemini API:', promptResult?.error);
      } catch (error) {
        console.warn('Offscreen document error, falling back to Gemini API:', error);
      }

      // 最后尝试 Gemini API 作为备用
      const aiResult = await this.aiService.extractOTP(emailContent, language);
      sendResponse({ 
        success: true, 
        otp: aiResult.otp, 
        method: 'gemini-api',
        confidence: aiResult.confidence 
      });
    } catch (error) {
      console.error('OTP extraction failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async extractOTPLocal(emailContent, language = 'auto') {
    const otpEngine = new OTPEngine();
    return await otpEngine.extractOTP(emailContent, language);
  }

  async handleTestChromePromptAPI(sendResponse) {
    try {
      // All Chrome Prompt API calls go through the offscreen document
      const result = await sendMessageToOffscreen({ action: 'offscreen-testConnection' });
      sendResponse(result);
    } catch (error) {
      console.error('Chrome Prompt API test failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleRequestPromptAPIPermissions(sendResponse) {
    try {
      // Permissions must be requested from a user action context, like the popup.
      // This is a placeholder, actual request should be triggered from popup.js
      const result = await chrome.permissions.request({ permissions: ['modelAccess'] });
      sendResponse({ success: result });
    } catch (error) {
      console.error('Request Prompt API permissions failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleCheckPromptAPIStatus(sendResponse) {
    try {
      const permissions = await this.aiService.chromePromptAPI.checkPermissions();
      const modelInfo = await this.aiService.chromePromptAPI.getModelInfo();
      
      sendResponse({
        success: true,
        permissions: permissions,
        modelInfo: modelInfo,
        isAvailable: this.aiService.chromePromptAPI.isAvailable
      });
    } catch (error) {
      console.error('Check Prompt API status failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

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

/**
 * Gmail API 服务类
 */
class GmailAPIService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://gmail.googleapis.com/gmail/v1';
  }

  async getLatestEmails(limit = 10) {
    try {
      // 获取邮件列表
      const listResponse = await fetch(
        `${this.baseURL}/users/me/messages?maxResults=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!listResponse.ok) {
        throw new Error(`Gmail API error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      const emails = [];

      // 获取每封邮件的详细信息
      for (const message of listData.messages || []) {
        try {
          const email = await this.getMessageDetails(message.id);
          emails.push(email);
        } catch (error) {
          console.warn(`Failed to get details for message ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      console.error('Failed to get latest emails:', error);
      throw error;
    }
  }

  async getMessageDetails(messageId) {
    const response = await fetch(
      `${this.baseURL}/users/me/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get message details: ${response.status}`);
    }

    const data = await response.json();
    return this.parseEmailData(data);
  }

  parseEmailData(data) {
    const headers = data.payload.headers;
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    return {
      id: data.id,
      subject: getHeader('Subject') || '',
      from: getHeader('From') || '',
      to: getHeader('To') || '',
      date: getHeader('Date') || '',
      snippet: data.snippet || '',
      body: this.extractEmailBody(data.payload)
    };
  }

  extractEmailBody(payload) {
    if (payload.body && payload.body.data) {
      return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        if (part.mimeType === 'text/html' && part.body && part.body.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }
    }

    return '';
  }
}

// Helper function to send messages to the offscreen document
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen.html';

async function sendMessageToOffscreen(message) {
  try {
    // Check if we have an existing offscreen document
    const hasDocument = await chrome.offscreen.hasDocument();
    
    if (!hasDocument) {
      // Create an offscreen document
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'AI processing for OTP extraction using Gemini Nano.',
      });
      
      // Wait a bit for the document to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send message to the offscreen document
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Offscreen document error:', error);
    throw error;
  }
}

// 初始化背景服务
new GmailOTPBackground();
