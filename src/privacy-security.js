/**
 * Gmail OTP AutoFill - 隐私保护和错误处理
 * 实现隐私最小化原则和全面的错误处理
 */

class PrivacyProtection {
  constructor() {
    this.dataRetentionDays = 7; // 数据保留7天
    this.maxOTPHistory = 10; // 最多保留10个OTP记录
    this.init();
  }

  async init() {
    await this.cleanupExpiredData();
    this.setupPeriodicCleanup();
  }

  // 清理过期数据
  async cleanupExpiredData() {
    try {
      const cutoffTime = Date.now() - (this.dataRetentionDays * 24 * 60 * 60 * 1000);
      
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = [];
        
        for (const [key, value] of Object.entries(items)) {
          // 清理过期的OTP记录
          if (key.startsWith('otp_') && value.timestamp < cutoffTime) {
            keysToRemove.push(key);
          }
          
          // 清理过期的使用统计
          if (key === 'aiUsageStats' && value.lastUsed < cutoffTime) {
            keysToRemove.push(key);
          }
        }
        
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove);
          console.log(`Cleaned up ${keysToRemove.length} expired records`);
        }
      });
    } catch (error) {
      console.error('Data cleanup failed:', error);
    }
  }

  // 设置定期清理
  setupPeriodicCleanup() {
    // 每小时检查一次
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000);
  }

  // 匿名化邮件内容
  anonymizeEmailContent(content) {
    if (!content) return '';
    
    // 移除邮箱地址
    let anonymized = content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // 移除电话号码
    anonymized = anonymized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // 移除URL
    anonymized = anonymized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    
    // 只保留前200个字符用于上下文
    return anonymized.substring(0, 200);
  }

  // 验证权限范围
  validatePermissions() {
    const requiredPermissions = [
      'activeTab',
      'storage',
      'identity',
      'scripting'
    ];
    
    const requiredHostPermissions = [
      'https://mail.google.com/*',
      'https://accounts.google.com/*'
    ];
    
    // 检查权限是否最小化
    chrome.permissions.getAll((permissions) => {
      const hasUnnecessaryPermissions = permissions.permissions.some(perm => 
        !requiredPermissions.includes(perm)
      );
      
      if (hasUnnecessaryPermissions) {
        console.warn('Extension has unnecessary permissions');
      }
    });
  }

  // 数据加密（简单实现）
  encryptSensitiveData(data) {
    // 简单的Base64编码，实际项目中应使用更强的加密
    return btoa(JSON.stringify(data));
  }

  // 数据解密
  decryptSensitiveData(encryptedData) {
    try {
      return JSON.parse(atob(encryptedData));
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }
}

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.init();
  }

  init() {
    // 监听未捕获的错误
    window.addEventListener('error', (event) => {
      this.logError('Uncaught Error', event.error);
    });

    // 监听Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', event.reason);
    });
  }

  // 记录错误
  logError(type, error, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      type: type,
      message: error?.message || error,
      stack: error?.stack,
      context: context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorLog.push(errorEntry);
    
    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // 存储到本地
    this.saveErrorLog();
    
    console.error(`[${type}]`, error, context);
  }

  // 保存错误日志
  saveErrorLog() {
    chrome.storage.local.set({ 
      errorLog: this.errorLog.slice(-20) // 只保存最近20个错误
    });
  }

  // 处理API错误
  handleAPIError(error, context) {
    let userMessage = '操作失败，请稍后重试';
    
    if (error.status === 401) {
      userMessage = '认证失败，请重新连接';
    } else if (error.status === 403) {
      userMessage = '权限不足，请检查权限设置';
    } else if (error.status === 429) {
      userMessage = '请求过于频繁，请稍后重试';
    } else if (error.status >= 500) {
      userMessage = '服务器错误，请稍后重试';
    }

    this.logError('API Error', error, context);
    return userMessage;
  }

  // 处理网络错误
  handleNetworkError(error, context) {
    this.logError('Network Error', error, context);
    return '网络连接失败，请检查网络设置';
  }

  // 处理存储错误
  handleStorageError(error, context) {
    this.logError('Storage Error', error, context);
    return '数据存储失败，请检查存储权限';
  }

  // 获取错误统计
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }

  // 清除错误日志
  clearErrorLog() {
    this.errorLog = [];
    chrome.storage.local.remove(['errorLog']);
  }
}

class DataValidator {
  constructor() {
    this.rules = this.initializeValidationRules();
  }

  initializeValidationRules() {
    return {
      otp: {
        pattern: /^\d{4,8}$/,
        message: 'OTP必须是4-8位数字'
      },
      email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: '邮箱格式不正确'
      },
      apiKey: {
        pattern: /^[A-Za-z0-9_-]+$/,
        message: 'API密钥格式不正确'
      },
      language: {
        pattern: /^(zh|en|es|it|auto)$/,
        message: '不支持的语言代码'
      }
    };
  }

  // 验证数据
  validate(data, type) {
    const rule = this.rules[type];
    if (!rule) {
      return { valid: true, message: 'Unknown validation type' };
    }

    if (!rule.pattern.test(data)) {
      return { valid: false, message: rule.message };
    }

    return { valid: true, message: 'Valid' };
  }

  // 验证OTP
  validateOTP(otp) {
    return this.validate(otp, 'otp');
  }

  // 验证邮箱
  validateEmail(email) {
    return this.validate(email, 'email');
  }

  // 验证API密钥
  validateAPIKey(apiKey) {
    return this.validate(apiKey, 'apiKey');
  }

  // 验证语言代码
  validateLanguage(language) {
    return this.validate(language, 'language');
  }

  // 清理输入数据
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .replace(/[<>]/g, '') // 移除HTML标签
      .substring(0, 1000); // 限制长度
  }
}

class SecurityManager {
  constructor() {
    this.cspViolations = [];
    this.init();
  }

  init() {
    // 监听CSP违规
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleCSPViolation(event);
    });
  }

  // 处理CSP违规
  handleCSPViolation(event) {
    const violation = {
      timestamp: Date.now(),
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy
    };

    this.cspViolations.push(violation);
    console.warn('CSP Violation:', violation);
  }

  // 检查内容安全策略
  checkCSP() {
    const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    return metaTags.length > 0;
  }

  // 验证外部资源
  validateExternalResource(url) {
    const allowedDomains = [
      'generativelanguage.googleapis.com',
      'gmail.googleapis.com',
      'accounts.google.com'
    ];

    try {
      const urlObj = new URL(url);
      return allowedDomains.includes(urlObj.hostname);
    } catch (error) {
      return false;
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PrivacyProtection,
    ErrorHandler,
    DataValidator,
    SecurityManager
  };
}
