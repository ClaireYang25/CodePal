/**
 * Gmail OTP AutoFill - Content Script
 * Monitors Gmail page for email changes, extracts and auto-fills OTP
 */

import { CONFIG } from '../config/constants.js';

class GmailMonitor {
  constructor() {
    this.lastProcessedEmails = new Set();
    this.init();
  }

  async init() {
    try {
      await this.waitForGmailLoad();
      this.setupEmailListeners();
      this.setupAutoFillListeners();
      console.log('✅ Gmail monitor initialized');
      
      // Process currently visible emails
      this.processCurrentEmails();
    } catch (error) {
      console.error('❌ Content script initialization failed:', error);
    }
  }

  /**
   * Wait for Gmail page to load completely
   */
  async waitForGmailLoad() {
    return new Promise((resolve) => {
      const checkGmail = () => {
        if (document.querySelector(CONFIG.GMAIL_SELECTORS.MAIN_CONTAINER) && 
            document.querySelector(CONFIG.GMAIL_SELECTORS.THREAD)) {
          resolve();
        } else {
          setTimeout(checkGmail, 500);
        }
      };
      checkGmail();
    });
  }

  /**
   * Setup email listeners
   */
  setupEmailListeners() {
    const emailContainer = document.querySelector(CONFIG.GMAIL_SELECTORS.MAIN_CONTAINER);
    if (!emailContainer) return;

    // Monitor DOM changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.handleEmailListChange();
        }
      });
    });
    
    observer.observe(emailContainer, {
      childList: true,
      subtree: true
    });

    // Monitor email clicks
    document.addEventListener('click', (event) => {
      const emailElement = event.target.closest(CONFIG.GMAIL_SELECTORS.THREAD);
      if (emailElement) {
        setTimeout(() => this.processEmailElement(emailElement), CONFIG.DELAYS.EMAIL_CLICK);
      }
    });
  }

  /**
   * Setup auto-fill listeners
   */
  setupAutoFillListeners() {
    // Listen for fill requests from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === CONFIG.ACTIONS.FILL_OTP) {
        this.fillOTPInCurrentPage(request.otp);
        sendResponse({ success: true });
      }
    });

    // Listen for input field focus events
    document.addEventListener('focusin', (event) => {
      if (this.isOTPInputField(event.target)) {
        this.handleOTPInputFocus(event.target);
      }
    });
  }

  /**
   * Handle email list changes (debounced)
   */
  handleEmailListChange() {
    clearTimeout(this.emailChangeTimeout);
    this.emailChangeTimeout = setTimeout(() => {
      this.processCurrentEmails();
    }, CONFIG.DELAYS.EMAIL_CHANGE);
  }

  /**
   * Process all current emails
   */
  async processCurrentEmails() {
    const emailElements = document.querySelectorAll(CONFIG.GMAIL_SELECTORS.THREAD);
    
    for (const emailElement of emailElements) {
      const threadId = emailElement.getAttribute('data-thread-id');
      
      if (!this.lastProcessedEmails.has(threadId)) {
        await this.processEmailElement(emailElement);
        this.lastProcessedEmails.add(threadId);
      }
    }
  }

  /**
   * Process a single email element
   */
  async processEmailElement(emailElement) {
    try {
      const emailContent = this.extractEmailContent(emailElement);
      if (!emailContent || emailContent.length < 10) return;

      const language = this.detectLanguage(emailContent);
      const otpResult = await this.extractOTP(emailContent, language);
      
      if (otpResult.success && otpResult.otp) {
        await this.storeOTP(otpResult.otp, emailContent);
        this.showOTPNotification(otpResult.otp);
      }
    } catch (error) {
      console.error('Failed to process email:', error);
    }
  }

  /**
   * Extract email content from element
   */
  extractEmailContent(emailElement) {
    const selectors = Object.values(CONFIG.GMAIL_SELECTORS).filter(s => 
      s !== CONFIG.GMAIL_SELECTORS.MAIN_CONTAINER && s !== CONFIG.GMAIL_SELECTORS.THREAD
    );

    for (const selector of selectors) {
      const element = emailElement.querySelector(selector);
      if (element?.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return emailElement.textContent.trim();
  }

  /**
   * Detect language from text
   */
  detectLanguage(text) {
    const patterns = {
      [CONFIG.LANGUAGES.CHINESE]: /[\u4e00-\u9fff]/,
      [CONFIG.LANGUAGES.SPANISH]: /[ñáéíóúü]/i,
      [CONFIG.LANGUAGES.ITALIAN]: /[àèéìíîòóù]/i
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    
    return CONFIG.LANGUAGES.ENGLISH;
  }

  /**
   * Extract OTP (via background script)
   */
  async extractOTP(content, language) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: CONFIG.ACTIONS.EXTRACT_OTP,
        emailContent: content,
        language: language
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error:", chrome.runtime.lastError.message);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false });
        }
      });
    });
  }

  /**
   * Store OTP in local storage
   */
  async storeOTP(otp, context) {
    const otpData = {
      otp: otp,
      timestamp: Date.now(),
      context: context.substring(0, CONFIG.OTP.CONTEXT_LENGTH),
      source: 'gmail'
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        [CONFIG.STORAGE_KEYS.LATEST_OTP]: otpData,
        [`otp_${Date.now()}`]: otpData 
      }, resolve);
    });
  }

  /**
   * Show OTP notification with modern UI
   */
  showOTPNotification(otp) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <strong>OTP Identified:</strong> 
        <span style="font-size: 18px; font-weight: bold;">${otp}</span>
        <button class="copy-otp" data-otp="${otp}" style="
          padding: 5px 10px;
          background: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 4px;
          cursor: pointer;
          color: #4CAF50;
        ">Copy</button>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: ${CONFIG.UI.NOTIFICATION.POSITION.top};
      right: ${CONFIG.UI.NOTIFICATION.POSITION.right};
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation styles if not already present
    if (!document.querySelector('#otp-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'otp-notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Copy functionality
    notification.querySelector('.copy-otp').addEventListener('click', (e) => {
      navigator.clipboard.writeText(e.target.dataset.otp);
      e.target.textContent = '✓ Copied';
      setTimeout(() => e.target.textContent = 'Copy', 2000);
    });

    document.body.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, CONFIG.UI.NOTIFICATION.DURATION);
  }

  /**
   * Check if element is an OTP input field
   */
  isOTPInputField(element) {
    if (!element || element.tagName !== 'INPUT') return false;
    
    const attributes = [
      element.name?.toLowerCase(),
      element.id?.toLowerCase(),
      element.placeholder?.toLowerCase(),
      element.className?.toLowerCase()
    ].filter(Boolean);

    return CONFIG.OTP_KEYWORDS.some(keyword => 
      attributes.some(attr => attr.includes(keyword))
    );
  }

  /**
   * Handle OTP input field focus
   */
  async handleOTPInputFocus(inputElement) {
    const latestOTP = await this.getLatestOTP();
    
    if (latestOTP && this.isRecentOTP(latestOTP.timestamp)) {
      inputElement.value = latestOTP.otp;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Get latest OTP from storage
   */
  async getLatestOTP() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.LATEST_OTP], (result) => {
        resolve(result[CONFIG.STORAGE_KEYS.LATEST_OTP]);
      });
    });
  }

  /**
   * Check if OTP is within expiry time
   */
  isRecentOTP(timestamp) {
    return (Date.now() - timestamp) < CONFIG.OTP.EXPIRY_TIME;
  }

  /**
   * Fill OTP in current page
   */
  fillOTPInCurrentPage(otp) {
    const otpInputs = document.querySelectorAll('input');
    
    for (const input of otpInputs) {
      if (this.isOTPInputField(input) && !input.value) {
        input.value = otp;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
    }
  }
}

// Initialize Gmail monitor
new GmailMonitor();
