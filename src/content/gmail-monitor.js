/**
 * Gmail OTP AutoFill - Content Script
 * 监听 Gmail 页面的邮件变化，提取并自动填充 OTP
 */

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
      
      // 处理当前可见邮件
      this.processCurrentEmails();
    } catch (error) {
      console.error('❌ Content script initialization failed:', error);
    }
  }

  /**
   * 等待 Gmail 页面加载完成
   */
  async waitForGmailLoad() {
    return new Promise((resolve) => {
      const checkGmail = () => {
        if (document.querySelector('[role="main"]') && 
            document.querySelector('[data-thread-id]')) {
          resolve();
        } else {
          setTimeout(checkGmail, 500);
        }
      };
      checkGmail();
    });
  }

  /**
   * 设置邮件监听器
   */
  setupEmailListeners() {
    const emailContainer = document.querySelector('[role="main"]');
    if (!emailContainer) return;

    // 监听 DOM 变化
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

    // 监听邮件点击
    document.addEventListener('click', (event) => {
      const emailElement = event.target.closest('[data-thread-id]');
      if (emailElement) {
        setTimeout(() => this.processEmailElement(emailElement), 1000);
      }
    });
  }

  /**
   * 设置自动填充监听器
   */
  setupAutoFillListeners() {
    // 监听来自后台的填充请求
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'fillOTP') {
        this.fillOTPInCurrentPage(request.otp);
        sendResponse({ success: true });
      }
    });

    // 监听输入框焦点事件
    document.addEventListener('focusin', (event) => {
      if (this.isOTPInputField(event.target)) {
        this.handleOTPInputFocus(event.target);
      }
    });
  }

  /**
   * 处理邮件列表变化
   */
  handleEmailListChange() {
    clearTimeout(this.emailChangeTimeout);
    this.emailChangeTimeout = setTimeout(() => {
      this.processCurrentEmails();
    }, 1000);
  }

  /**
   * 处理当前所有邮件
   */
  async processCurrentEmails() {
    const emailElements = document.querySelectorAll('[data-thread-id]');
    
    for (const emailElement of emailElements) {
      const threadId = emailElement.getAttribute('data-thread-id');
      
      if (!this.lastProcessedEmails.has(threadId)) {
        await this.processEmailElement(emailElement);
        this.lastProcessedEmails.add(threadId);
      }
    }
  }

  /**
   * 处理单个邮件元素
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
   * 提取邮件内容
   */
  extractEmailContent(emailElement) {
    const selectors = [
      '.y2',              // Gmail 邮件预览
      '.yP',              // 邮件正文
      '[data-message-id] .y2',
      '.thread-snippet'
    ];

    for (const selector of selectors) {
      const element = emailElement.querySelector(selector);
      if (element?.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return emailElement.textContent.trim();
  }

  /**
   * 检测语言
   */
  detectLanguage(text) {
    const patterns = {
      zh: /[\u4e00-\u9fff]/,
      es: /[ñáéíóúü]/i,
      it: /[àèéìíîòóù]/i
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }
    
    return 'en';
  }

  /**
   * 提取 OTP (通过后台脚本)
   */
  async extractOTP(content, language) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'extractOTP',
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
   * 存储 OTP
   */
  async storeOTP(otp, context) {
    const otpData = {
      otp: otp,
      timestamp: Date.now(),
      context: context.substring(0, 200),
      source: 'gmail'
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        latestOTP: otpData,
        [`otp_${Date.now()}`]: otpData 
      }, resolve);
    });
  }

  /**
   * 显示 OTP 通知
   */
  showOTPNotification(otp) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <strong>验证码已识别:</strong> 
        <span style="font-size: 18px; font-weight: bold;">${otp}</span>
        <button class="copy-otp" data-otp="${otp}" style="
          padding: 5px 10px;
          background: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 4px;
          cursor: pointer;
          color: #4CAF50;
        ">复制</button>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
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

    // 添加动画样式
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

    // 复制功能
    notification.querySelector('.copy-otp').addEventListener('click', (e) => {
      navigator.clipboard.writeText(e.target.dataset.otp);
      e.target.textContent = '✓ 已复制';
      setTimeout(() => e.target.textContent = '复制', 2000);
    });

    document.body.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * 判断是否为 OTP 输入框
   */
  isOTPInputField(element) {
    if (!element || element.tagName !== 'INPUT') return false;
    
    const keywords = [
      'otp', 'verification', 'code', 'token', 'pin',
      '验证码', '验证', '代码'
    ];
    
    const attributes = [
      element.name?.toLowerCase(),
      element.id?.toLowerCase(),
      element.placeholder?.toLowerCase(),
      element.className?.toLowerCase()
    ].filter(Boolean);

    return keywords.some(keyword => 
      attributes.some(attr => attr.includes(keyword))
    );
  }

  /**
   * 处理 OTP 输入框焦点
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
   * 获取最新 OTP
   */
  async getLatestOTP() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['latestOTP'], (result) => {
        resolve(result.latestOTP);
      });
    });
  }

  /**
   * 检查 OTP 是否在有效期内（5分钟）
   */
  isRecentOTP(timestamp) {
    return (Date.now() - timestamp) < 5 * 60 * 1000;
  }

  /**
   * 在当前页面填充 OTP
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

// 初始化 Gmail 监听器
new GmailMonitor();

