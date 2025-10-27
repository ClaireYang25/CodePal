/**
 * Gmail OTP AutoFill - Popup 脚本
 * 处理弹窗界面的交互和状态管理
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
      // 检查 Gmail 连接状态
      const gmailStatus = await this.checkGmailStatus();
      this.updateStatusElement('gmail-status', gmailStatus.text, gmailStatus.class);

      // 检查 AI 服务状态
      const aiStatus = await this.checkAIStatus();
      this.updateStatusElement('ai-status', aiStatus.text, aiStatus.class);

      // 获取最新 OTP
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
    return (Date.now() - timestamp) < 5 * 60 * 1000; // 5分钟内有效
  }

  updateStatusElement(elementId, text, className) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
      element.className = `status-value ${className}`;
    }
  }

  setupEventListeners() {
    // Gmail 连接按钮
    document.getElementById('connect-gmail').addEventListener('click', () => {
      this.connectGmail();
    });

    // Chrome Prompt API 测试按钮
    document.getElementById('test-chrome-prompt-api').addEventListener('click', () => {
      this.testChromePromptAPI();
    });

    // Gemini API 测试按钮
    document.getElementById('test-gemini-api').addEventListener('click', () => {
      this.testGeminiAPI();
    });

    // 清除数据按钮
    document.getElementById('clear-data').addEventListener('click', () => {
      this.clearData();
    });

    // API 密钥保存按钮
    document.getElementById('save-api-key').addEventListener('click', () => {
      this.saveAPIKey();
    });

    // 设置开关
    document.getElementById('auto-fill-toggle').addEventListener('click', () => {
      this.toggleSetting('autoFill');
    });

    document.getElementById('chrome-prompt-api-toggle').addEventListener('click', () => {
      this.toggleSetting('chromePromptAPI');
    });

    document.getElementById('gemini-api-toggle').addEventListener('click', () => {
      this.toggleSetting('geminiAPI');
    });

    document.getElementById('notification-toggle').addEventListener('click', () => {
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

  async testChromePromptAPI() {
    const button = document.getElementById('test-chrome-prompt-api');
    button.classList.add('loading');
    button.textContent = '测试中...';

    try {
      const response = await this.sendMessage({ action: 'testChromePromptAPI' });
      
      if (response.success) {
        this.showMessage('Chrome Prompt API 测试成功！', 'success');
        await this.updateStatus();
      } else {
        this.showMessage(`Chrome Prompt API 测试失败: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Chrome Prompt API 测试错误: ${error.message}`, 'error');
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
      const response = await this.sendMessage({ action: 'testAI' });
      
      if (response.success) {
        this.showMessage('Gemini API 测试成功！', 'success');
        await this.updateStatus();
      } else {
        this.showMessage(`Gemini API 测试失败: ${response.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Gemini API 测试错误: ${error.message}`, 'error');
    } finally {
      button.classList.remove('loading');
      button.textContent = '测试 Gemini API';
    }
  }

  async clearData() {
    if (confirm('确定要清除所有数据吗？这将删除所有存储的 OTP 和设置。')) {
      try {
        await this.sendMessage({ action: 'clearData' });
        this.showMessage('数据已清除', 'success');
        await this.updateStatus();
        await this.loadSettings();
        this.updateUI();
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
      await this.sendMessage({ 
        action: 'saveAPIKey', 
        apiKey: apiKey 
      });
      
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
    // 更新开关状态
    document.getElementById('auto-fill-toggle').classList.toggle('active', this.settings.autoFill);
    document.getElementById('chrome-prompt-api-toggle').classList.toggle('active', this.settings.chromePromptAPI);
    document.getElementById('gemini-api-toggle').classList.toggle('active', this.settings.geminiAPI);
    document.getElementById('notification-toggle').classList.toggle('active', this.settings.notifications);
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
    // 移除现有消息
    const existingMessage = document.querySelector('.error, .success');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 创建新消息
    const message = document.createElement('div');
    message.className = type;
    message.textContent = text;
    
    // 插入到内容区域顶部
    const content = document.querySelector('.content');
    content.insertBefore(message, content.firstChild);

    // 3秒后自动移除
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }
}

// 初始化弹窗控制器
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
