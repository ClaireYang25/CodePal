/**
 * Gmail OTP AutoFill - Popup Controller
 * Manages extension popup interactions and state
 */

import { CONFIG } from '../config/constants.js';

// UI Text Constants
const UI_TEXT = {
  STATUS: {
    CONNECTED: 'Connected',
    DISCONNECTED: 'Disconnected',
    CONFIGURED: 'Configured',
    NOT_CONFIGURED: 'Not Configured',
    NONE: 'None',
    CHECKING: 'Checking...'
  },
  BUTTONS: {
    CONNECT_GMAIL: 'Connect Gmail',
    CONNECTING: 'Connecting...',
    TEST_NANO: 'Test Gemini Nano',
    TESTING: 'Testing...',
    TEST_API: 'Test Gemini API'
  },
  MESSAGES: {
    GMAIL_SUCCESS: 'Gmail connected successfully!',
    GMAIL_ERROR: 'Connection failed',
    NANO_SUCCESS: 'Gemini Nano test successful!',
    NANO_ERROR: 'Gemini Nano test failed',
    API_SUCCESS: 'Gemini API test successful!',
    API_ERROR: 'Gemini API test failed',
    TEST_ERROR: 'Test error',
    DATA_CLEARED: 'Data cleared',
    CLEAR_FAILED: 'Clear failed',
    KEY_SAVED: 'API key saved',
    KEY_SAVE_FAILED: 'Save failed',
    ENTER_KEY: 'Please enter API key',
    CONFIRM_CLEAR: 'Are you sure you want to clear all data?'
  }
};

class PopupController {
  constructor() {
    this.settings = {
      autoFill: true,
      chromePromptAPI: true,
      geminiAPI: true,
      notifications: true
    };
    this.init();
  }

  async init() {
    try {
      await this.loadSettings();
      await this.updateStatus();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Popup initialization failed:', error);
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.POPUP_SETTINGS], (result) => {
        if (result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS]) {
          this.settings = { ...this.settings, ...result[CONFIG.STORAGE_KEYS.POPUP_SETTINGS] };
        }
        resolve();
      });
    });
  }

  async saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        [CONFIG.STORAGE_KEYS.POPUP_SETTINGS]: this.settings 
      }, resolve);
    });
  }

  async updateStatus() {
    try {
      const gmailStatus = await this.checkGmailStatus();
      this.updateStatusElement('gmail-status', gmailStatus.text, gmailStatus.class);

      const aiStatus = await this.checkAIStatus();
      this.updateStatusElement('ai-status', aiStatus.text, aiStatus.class);

      const latestOTP = await this.getLatestOTP();
      this.updateStatusElement('latest-otp', latestOTP.text, latestOTP.class);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async checkGmailStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: CONFIG.ACTIONS.CHECK_AUTH_STATUS }, (response) => {
        if (response && response.authenticated) {
          resolve({ text: UI_TEXT.STATUS.CONNECTED, class: 'connected' });
        } else {
          resolve({ text: UI_TEXT.STATUS.DISCONNECTED, class: 'disconnected' });
        }
      });
    });
  }

  async checkAIStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.GEMINI_API_KEY], (result) => {
        if (result[CONFIG.STORAGE_KEYS.GEMINI_API_KEY]) {
          resolve({ text: UI_TEXT.STATUS.CONFIGURED, class: 'connected' });
        } else {
          resolve({ text: UI_TEXT.STATUS.NOT_CONFIGURED, class: 'disconnected' });
        }
      });
    });
  }

  async getLatestOTP() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.LATEST_OTP], (result) => {
        if (result[CONFIG.STORAGE_KEYS.LATEST_OTP] && 
            this.isRecentOTP(result[CONFIG.STORAGE_KEYS.LATEST_OTP].timestamp)) {
          resolve({ 
            text: result[CONFIG.STORAGE_KEYS.LATEST_OTP].otp, 
            class: 'connected' 
          });
        } else {
          resolve({ text: UI_TEXT.STATUS.NONE, class: 'disconnected' });
        }
      });
    });
  }

  isRecentOTP(timestamp) {
    return (Date.now() - timestamp) < CONFIG.OTP.EXPIRY_TIME;
  }

  updateStatusElement(elementId, text, className) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
      element.className = `status-value ${className}`;
    }
  }

  setupEventListeners() {
    document.getElementById('connect-gmail')?.addEventListener('click', () => {
      this.connectGmail();
    });

    document.getElementById('test-chrome-prompt-api')?.addEventListener('click', () => {
      this.testGeminiNano();
    });

    document.getElementById('test-gemini-api')?.addEventListener('click', () => {
      this.testGeminiAPI();
    });

    document.getElementById('clear-data')?.addEventListener('click', () => {
      this.clearData();
    });

    document.getElementById('save-api-key')?.addEventListener('click', () => {
      this.saveAPIKey();
    });

    document.getElementById('auto-fill-toggle')?.addEventListener('click', () => {
      this.toggleSetting('autoFill');
    });

    document.getElementById('chrome-prompt-api-toggle')?.addEventListener('click', () => {
      this.toggleSetting('chromePromptAPI');
    });

    document.getElementById('gemini-api-toggle')?.addEventListener('click', () => {
      this.toggleSetting('geminiAPI');
    });

    document.getElementById('notification-toggle')?.addEventListener('click', () => {
      this.toggleSetting('notifications');
    });
  }

  async connectGmail() {
    const button = document.getElementById('connect-gmail');
    button.classList.add('loading');
    button.textContent = UI_TEXT.BUTTONS.CONNECTING;

    try {
      const response = await this.sendMessage({ action: CONFIG.ACTIONS.AUTHENTICATE });
      
      if (response.success) {
        this.showMessage(UI_TEXT.MESSAGES.GMAIL_SUCCESS, 'success');
        await this.updateStatus();
      } else {
        this.showMessage(`${UI_TEXT.MESSAGES.GMAIL_ERROR}: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`${UI_TEXT.MESSAGES.GMAIL_ERROR}: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = UI_TEXT.BUTTONS.CONNECT_GMAIL;
    }
  }

  async testGeminiNano() {
    const button = document.getElementById('test-chrome-prompt-api');
    button.classList.add('loading');
    button.textContent = UI_TEXT.BUTTONS.TESTING;

    try {
      const response = await this.sendMessage({ action: CONFIG.ACTIONS.TEST_GEMINI_NANO });
      
      if (response.success) {
        this.showMessage(UI_TEXT.MESSAGES.NANO_SUCCESS, 'success');
      } else {
        this.showMessage(`${UI_TEXT.MESSAGES.NANO_ERROR}: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`${UI_TEXT.MESSAGES.TEST_ERROR}: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = UI_TEXT.BUTTONS.TEST_NANO;
    }
  }

  async testGeminiAPI() {
    const button = document.getElementById('test-gemini-api');
    button.classList.add('loading');
    button.textContent = UI_TEXT.BUTTONS.TESTING;

    try {
      const response = await this.sendMessage({ action: CONFIG.ACTIONS.TEST_GEMINI_API });
      
      if (response.success) {
        this.showMessage(UI_TEXT.MESSAGES.API_SUCCESS, 'success');
      } else {
        this.showMessage(`${UI_TEXT.MESSAGES.API_ERROR}: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`${UI_TEXT.MESSAGES.TEST_ERROR}: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = UI_TEXT.BUTTONS.TEST_API;
    }
  }

  async clearData() {
    if (confirm(UI_TEXT.MESSAGES.CONFIRM_CLEAR)) {
      try {
        await chrome.storage.local.clear();
        this.showMessage(UI_TEXT.MESSAGES.DATA_CLEARED, 'success');
        await this.updateStatus();
      } catch (error) {
        this.showMessage(`${UI_TEXT.MESSAGES.CLEAR_FAILED}: ${error.message}`, 'error');
      }
    }
  }

  async saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    
    if (!apiKey) {
      this.showMessage(UI_TEXT.MESSAGES.ENTER_KEY, 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ 
        [CONFIG.STORAGE_KEYS.GEMINI_API_KEY]: apiKey 
      });
      this.showMessage(UI_TEXT.MESSAGES.KEY_SAVED, 'success');
      document.getElementById('api-key-input').value = '';
      await this.updateStatus();
    } catch (error) {
      this.showMessage(`${UI_TEXT.MESSAGES.KEY_SAVE_FAILED}: ${error.message}`, 'error');
    }
  }

  toggleSetting(settingName) {
    this.settings[settingName] = !this.settings[settingName];
    this.saveSettings();
    this.updateUI();
  }

  updateUI() {
    document.getElementById('auto-fill-toggle')?.classList.toggle('active', this.settings.autoFill);
    document.getElementById('chrome-prompt-api-toggle')?.classList.toggle('active', this.settings.chromePromptAPI);
    document.getElementById('gemini-api-toggle')?.classList.toggle('active', this.settings.geminiAPI);
    document.getElementById('notification-toggle')?.classList.toggle('active', this.settings.notifications);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  showMessage(text, type) {
    const existingMessage = document.querySelector('.error, .success');
    if (existingMessage) existingMessage.remove();

    const message = document.createElement('div');
    message.className = type;
    message.textContent = text;
    
    const content = document.querySelector('.content');
    content.insertBefore(message, content.firstChild);

    setTimeout(() => message.remove(), 3000);
  }
}

// Initialize popup controller
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
