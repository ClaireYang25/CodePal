/**
 * Gmail OTP AutoFill - Content Script
 * 在 Gmail 页面中监听邮件变化，提取 OTP 并自动填充
 */

class GmailOTPContentScript {
  constructor() {
    this.isInitialized = false;
    this.lastProcessedEmails = new Set();
    this.init();
  }

  async init() {
    try {
      // 等待 Gmail 页面完全加载
      await this.waitForGmailLoad();
      
      // 设置邮件监听器
      this.setupEmailListeners();
      
      // 设置自动填充监听器
      this.setupAutoFillListeners();
      
      this.isInitialized = true;
      console.log('Gmail OTP Content Script initialized');
      
      // 处理当前可见的邮件
      this.processCurrentEmails();
    } catch (error) {
      console.error('Content script initialization failed:', error);
    }
  }

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

  setupEmailListeners() {
    // 监听 Gmail 的邮件列表变化
    const emailContainer = document.querySelector('[role="main"]');
    if (emailContainer) {
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
    }

    // 监听邮件点击事件
    document.addEventListener('click', (event) => {
      const emailElement = event.target.closest('[data-thread-id]');
      if (emailElement) {
        setTimeout(() => this.processEmailElement(emailElement), 1000);
      }
    });
  }

  setupAutoFillListeners() {
    // 监听来自其他页面的 OTP 填充请求
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'fillOTP') {
        this.fillOTPInCurrentPage(request.otp);
        sendResponse({ success: true });
      }
    });

    // 监听页面输入框焦点事件
    document.addEventListener('focusin', (event) => {
      if (this.isOTPInputField(event.target)) {
        this.handleOTPInputFocus(event.target);
      }
    });
  }

  async handleEmailListChange() {
    // 防抖处理
    clearTimeout(this.emailChangeTimeout);
    this.emailChangeTimeout = setTimeout(() => {
      this.processCurrentEmails();
    }, 1000);
  }

  async processCurrentEmails() {
    try {
      const emailElements = document.querySelectorAll('[data-thread-id]');
      
      for (const emailElement of emailElements) {
        const threadId = emailElement.getAttribute('data-thread-id');
        
        if (!this.lastProcessedEmails.has(threadId)) {
          await this.processEmailElement(emailElement);
          this.lastProcessedEmails.add(threadId);
        }
      }
    } catch (error) {
      console.error('Failed to process current emails:', error);
    }
  }

  async processEmailElement(emailElement) {
    try {
      // 提取邮件内容
      const emailContent = this.extractEmailContent(emailElement);
      
      if (!emailContent || emailContent.length < 10) {
        return;
      }

      // 检测语言
      const language = this.detectLanguage(emailContent);
      
      // 提取 OTP
      const otpResult = await this.extractOTPFromContent(emailContent, language);
      
      if (otpResult.success && otpResult.otp) {
        // 存储 OTP 到本地存储
        await this.storeOTP(otpResult.otp, emailContent);
        
        // 显示通知
        this.showOTPNotification(otpResult.otp);
        
        // 检查是否有需要填充的页面
        await this.checkAndFillOTP(otpResult.otp);
      }
    } catch (error) {
      console.error('Failed to process email element:', error);
    }
  }

  extractEmailContent(emailElement) {
    // 尝试多种方式提取邮件内容
    const selectors = [
      '.y2', // Gmail 邮件预览文本
      '.yP', // 邮件正文
      '[data-message-id] .y2', // 特定邮件内容
      '.thread-snippet' // 线程摘要
    ];

    for (const selector of selectors) {
      const element = emailElement.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // 如果找不到内容，尝试获取整个元素的文本
    return emailElement.textContent.trim();
  }

  detectLanguage(text) {
    // 简单的语言检测
    const chineseRegex = /[\u4e00-\u9fff]/;
    const englishRegex = /[a-zA-Z]/;
    const spanishRegex = /[ñáéíóúü]/i;
    const italianRegex = /[àèéìíîòóù]/i;

    if (chineseRegex.test(text)) return 'zh';
    if (spanishRegex.test(text)) return 'es';
    if (italianRegex.test(text)) return 'it';
    if (englishRegex.test(text)) return 'en';
    
    return 'auto';
  }

  async extractOTPFromContent(content, language) {
    // All OTP extraction is now handled by the background script
    // to avoid module loading issues in the content script context.
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'extractOTP',
        emailContent: content,
        language: language
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Handle potential errors like the service worker being inactive
          console.error("Error sending message to background:", chrome.runtime.lastError.message);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else if (response && response.success) {
          resolve(response);
        } else {
          resolve({ success: false, error: response?.error || 'Unknown error from background script' });
        }
      });
    });
  }

  async storeOTP(otp, context) {
    const otpData = {
      otp: otp,
      timestamp: Date.now(),
      context: context.substring(0, 200), // 只存储前200个字符
      source: 'gmail'
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        latestOTP: otpData,
        [`otp_${Date.now()}`]: otpData 
      }, resolve);
    });
  }

  showOTPNotification(otp) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'gmail-otp-notification';
    notification.innerHTML = `
      <div class="otp-content">
        <strong>验证码已识别:</strong> ${otp}
        <button class="copy-otp" data-otp="${otp}">复制</button>
      </div>
    `;

    // 添加样式
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 300px;
    `;

    // 添加复制功能
    notification.querySelector('.copy-otp').addEventListener('click', (e) => {
      navigator.clipboard.writeText(e.target.dataset.otp);
      e.target.textContent = '已复制!';
      setTimeout(() => e.target.textContent = '复制', 2000);
    });

    document.body.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  isOTPInputField(element) {
    if (!element || element.tagName !== 'INPUT') return false;
    
    const otpKeywords = [
      'otp', 'verification', 'code', 'token', 'pin',
      '验证码', '验证', '代码', '密码', '码'
    ];
    
    const fieldAttributes = [
      element.name?.toLowerCase(),
      element.id?.toLowerCase(),
      element.placeholder?.toLowerCase(),
      element.className?.toLowerCase()
    ].filter(Boolean);

    return otpKeywords.some(keyword => 
      fieldAttributes.some(attr => attr.includes(keyword))
    );
  }

  async handleOTPInputFocus(inputElement) {
    // 获取最新的 OTP
    const latestOTP = await this.getLatestOTP();
    
    if (latestOTP && this.isRecentOTP(latestOTP.timestamp)) {
      // 自动填充 OTP
      inputElement.value = latestOTP.otp;
      
      // 触发输入事件
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 显示填充提示
      this.showFillNotification(inputElement);
    }
  }

  async getLatestOTP() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['latestOTP'], (result) => {
        resolve(result.latestOTP);
      });
    });
  }

  isRecentOTP(timestamp) {
    // OTP 在5分钟内有效
    return (Date.now() - timestamp) < 5 * 60 * 1000;
  }

  showFillNotification(inputElement) {
    const rect = inputElement.getBoundingClientRect();
    const notification = document.createElement('div');
    notification.textContent = '✓ 验证码已自动填充';
    notification.style.cssText = `
      position: fixed;
      top: ${rect.top - 30}px;
      left: ${rect.left}px;
      background: #4CAF50;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10001;
      pointer-events: none;
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }

  async checkAndFillOTP(otp) {
    // 检查是否有其他标签页需要填充 OTP
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.url && tab.url !== 'chrome://newtab/' && tab.url !== chrome.runtime.getURL('')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'fillOTP',
              otp: otp
            });
          } catch (error) {
            // 忽略无法发送消息的标签页
          }
        }
      }
    } catch (error) {
      console.error('Failed to check and fill OTP:', error);
    }
  }

  fillOTPInCurrentPage(otp) {
    const otpInputs = document.querySelectorAll('input');
    
    for (const input of otpInputs) {
      if (this.isOTPInputField(input) && !input.value) {
        input.value = otp;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        this.showFillNotification(input);
        break; // 只填充第一个匹配的输入框
      }
    }
  }
}

// 初始化内容脚本
new GmailOTPContentScript();
