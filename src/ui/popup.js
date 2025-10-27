/**
 * Gmail OTP AutoFill - Popup Controller
 * 管理扩展弹窗的交互和状态
 */

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
      chrome.storage.local.get(['popupSettings'], (result) => {
        if (result.popupSettings) {
          this.settings = { ...this.settings, ...result.popupSettings };
        }
        resolve();
      });
    });
  }

  async saveSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ popupSettings: this.settings }, resolve);
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
      chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
        if (response && response.authenticated) {
          resolve({ text: '已连接', class: 'connected' });
        } else {
          resolve({ text: '未连接', class: 'disconnected' });
        }
      });
    });
  }

  async checkAIStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
          resolve({ text: '已配置', class: 'connected' });
        } else {
          resolve({ text: '未配置', class: 'disconnected' });
        }
      });
    });
  }

  async getLatestOTP() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['latestOTP'], (result) => {
        if (result.latestOTP && this.isRecentOTP(result.latestOTP.timestamp)) {
          resolve({ text: result.latestOTP.otp, class: 'connected' });
        } else {
          resolve({ text: '无', class: 'disconnected' });
        }
      });
    });
  }

  isRecentOTP(timestamp) {
    return (Date.now() - timestamp) < 5 * 60 * 1000;
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
    button.textContent = '连接中...';

    try {
      const response = await this.sendMessage({ action: 'authenticate' });
      
      if (response.success) {
        this.showMessage('Gmail 连接成功！', 'success');
        await this.updateStatus();
      } else {
        this.showMessage(`连接失败: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`连接错误: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = '连接 Gmail';
    }
  }

  async testGeminiNano() {
    const button = document.getElementById('test-chrome-prompt-api');
    button.classList.add('loading');
    button.textContent = '测试中...';

    try {
      const response = await this.sendMessage({ action: 'testGeminiNano' });
      
      if (response.success) {
        this.showMessage('Gemini Nano 测试成功！', 'success');
      } else {
        this.showMessage(`Gemini Nano 测试失败: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`测试错误: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = '测试 Chrome Prompt API';
    }
  }

  async testGeminiAPI() {
    const button = document.getElementById('test-gemini-api');
    button.classList.add('loading');
    button.textContent = '测试中...';

    try {
      const response = await this.sendMessage({ action: 'testGeminiAPI' });
      
      if (response.success) {
        this.showMessage('Gemini API 测试成功！', 'success');
      } else {
        this.showMessage(`Gemini API 测试失败: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`测试错误: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = '测试 Gemini API';
    }
  }

  async clearData() {
    if (confirm('确定要清除所有数据吗？')) {
      try {
        await chrome.storage.local.clear();
        this.showMessage('数据已清除', 'success');
        await this.updateStatus();
      } catch (error) {
        this.showMessage(`清除失败: ${error.message}`, 'error');
      }
    }
  }

  async saveAPIKey() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    
    if (!apiKey) {
      this.showMessage('请输入 API 密钥', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ geminiApiKey: apiKey });
      this.showMessage('API 密钥已保存', 'success');
      document.getElementById('api-key-input').value = '';
      await this.updateStatus();
    } catch (error) {
      this.showMessage(`保存失败: ${error.message}`, 'error');
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

