/**
 * Gmail OTP AutoFill - Prompt 模板
 * 为 Gemini Nano API 设计的专业 OTP 提取提示词
 */

class PromptTemplates {
  constructor() {
    this.templates = this.initializeTemplates();
  }

  initializeTemplates() {
    return {
      // 基础 OTP 提取模板
      basic: {
        system: `你是一个专业的邮件验证码提取助手。你的任务是准确识别邮件中的一次性验证码（OTP）。

核心能力：
- 多语言支持（中文、英文、西班牙语、意大利语等）
- 智能上下文理解
- 高精度验证码识别
- 格式验证和清理

请始终返回标准JSON格式的响应。`,
        
        user: `请从以下邮件内容中提取一次性验证码：

邮件内容：
"""
{emailContent}
"""

请按照以下JSON格式返回结果：
{
  "otp": "提取到的验证码（纯数字，4-8位）",
  "confidence": 0.95,
  "reasoning": "提取理由和判断依据",
  "language": "检测到的邮件语言",
  "context": "验证码出现的上下文片段",
  "isValid": true,
  "alternatives": ["其他可能的验证码"]
}

规则：
1. 只提取数字验证码（4-8位）
2. 如果找到多个验证码，选择最可能是OTP的那个
3. 如果找不到验证码，otp设为null，confidence设为0
4. confidence范围0-1，表示提取的置信度
5. 如果邮件不是验证码邮件，isValid设为false

请直接返回JSON，不要包含其他内容。`
      },

      // 多语言专用模板
      multilingual: {
        zh: `请从以下中文邮件中提取验证码：

邮件内容：
"""
{emailContent}
"""

中文验证码特征：
- 关键词：验证码、验证、代码、密码、码
- 常见格式：验证码：123456、您的验证码是123456
- 上下文：登录、注册、安全验证、身份验证

请返回JSON格式结果。`,
        
        en: `Please extract the verification code from the following English email:

Email content:
"""
{emailContent}
"""

English verification code features:
- Keywords: verification code, OTP, PIN, token, code
- Common formats: verification code: 123456, your code is 123456
- Context: login, signup, security verification, authentication

Please return JSON format result.`,
        
        es: `Por favor extrae el código de verificación del siguiente correo en español:

Contenido del correo:
"""
{emailContent}
"""

Características del código de verificación en español:
- Palabras clave: código de verificación, código, verificación
- Formatos comunes: código de verificación: 123456, tu código es 123456
- Contexto: inicio de sesión, registro, verificación de seguridad

Por favor devuelve el resultado en formato JSON.`,
        
        it: `Per favore estrai il codice di verifica dalla seguente email in italiano:

Contenuto dell'email:
"""
{emailContent}
"""

Caratteristiche del codice di verifica in italiano:
- Parole chiave: codice di verifica, codice, verifica
- Formati comuni: codice di verifica: 123456, il tuo codice è 123456
- Contesto: accesso, registrazione, verifica di sicurezza

Per favore restituisci il risultato in formato JSON.`
      },

      // 复杂邮件处理模板
      complex: {
        html: `请从以下HTML邮件中提取验证码。注意处理HTML标签和嵌套结构：

邮件内容：
"""
{emailContent}
"""

处理规则：
1. 忽略HTML标签，只关注文本内容
2. 注意表格、列表等结构化内容中的验证码
3. 识别图片中的验证码描述
4. 处理多段落邮件中的验证码

请返回JSON格式结果。`,
        
        multiple: `请从以下可能包含多个验证码的邮件中提取最相关的一个：

邮件内容：
"""
{emailContent}
"""

选择规则：
1. 优先选择明确标注为"验证码"的数字
2. 选择在安全相关上下文中的数字
3. 选择格式最标准的验证码（6位优先）
4. 如果存在多个候选，在alternatives字段中列出

请返回JSON格式结果。`
      },

      // 错误处理模板
      error: {
        noCode: `请分析以下邮件是否包含验证码：

邮件内容：
"""
{emailContent}
"""

如果没有找到验证码，请返回：
{
  "otp": null,
  "confidence": 0,
  "reasoning": "未找到验证码的原因",
  "language": "检测到的语言",
  "context": null,
  "isValid": false,
  "alternatives": []
}

请返回JSON格式结果。`,
        
        ambiguous: `以下邮件包含多个可能的验证码，请选择最合适的一个：

邮件内容：
"""
{emailContent}
"""

分析要求：
1. 分析每个数字的上下文
2. 确定哪个最可能是OTP
3. 在reasoning中说明选择理由
4. 在alternatives中列出其他候选

请返回JSON格式结果。`
      }
    };
  }

  // 获取基础模板
  getBasicTemplate(emailContent) {
    return this.templates.basic.user.replace('{emailContent}', emailContent);
  }

  // 获取多语言模板
  getMultilingualTemplate(emailContent, language) {
    const template = this.templates.multilingual[language];
    if (!template) {
      return this.getBasicTemplate(emailContent);
    }
    return template.replace('{emailContent}', emailContent);
  }

  // 获取复杂邮件模板
  getComplexTemplate(emailContent, type = 'html') {
    const template = this.templates.complex[type];
    if (!template) {
      return this.getBasicTemplate(emailContent);
    }
    return template.replace('{emailContent}', emailContent);
  }

  // 获取错误处理模板
  getErrorTemplate(emailContent, type = 'noCode') {
    const template = this.templates.error[type];
    if (!template) {
      return this.getBasicTemplate(emailContent);
    }
    return template.replace('{emailContent}', emailContent);
  }

  // 智能选择模板
  selectTemplate(emailContent, language = 'auto', context = {}) {
    // 检测邮件类型
    const isHTML = emailContent.includes('<') && emailContent.includes('>');
    const hasMultipleNumbers = (emailContent.match(/\d{4,8}/g) || []).length > 1;
    const hasKeywords = this.hasVerificationKeywords(emailContent);

    // 选择最合适的模板
    if (!hasKeywords && !hasMultipleNumbers) {
      return this.getErrorTemplate(emailContent, 'noCode');
    }

    if (hasMultipleNumbers) {
      return this.getErrorTemplate(emailContent, 'ambiguous');
    }

    if (isHTML) {
      return this.getComplexTemplate(emailContent, 'html');
    }

    if (language !== 'auto') {
      return this.getMultilingualTemplate(emailContent, language);
    }

    return this.getBasicTemplate(emailContent);
  }

  // 检查是否包含验证关键词
  hasVerificationKeywords(content) {
    const keywords = [
      // 中文
      '验证码', '验证', '代码', '密码', '码',
      // 英文
      'verification', 'code', 'otp', 'pin', 'token',
      // 西班牙语
      'código', 'verificación',
      // 意大利语
      'codice', 'verifica'
    ];

    return keywords.some(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 构建完整提示词
  buildPrompt(emailContent, language = 'auto', context = {}) {
    const systemPrompt = this.templates.basic.system;
    const userPrompt = this.selectTemplate(emailContent, language, context);
    
    return {
      system: systemPrompt,
      user: userPrompt,
      metadata: {
        language: language,
        contentLength: emailContent.length,
        hasHTML: emailContent.includes('<'),
        timestamp: Date.now()
      }
    };
  }

  // 验证响应格式
  validateResponse(response) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      
      const requiredFields = ['otp', 'confidence', 'reasoning', 'language'];
      const hasRequiredFields = requiredFields.every(field => field in parsed);
      
      if (!hasRequiredFields) {
        return { valid: false, error: 'Missing required fields' };
      }

      if (parsed.otp !== null && typeof parsed.otp !== 'string') {
        return { valid: false, error: 'OTP must be string or null' };
      }

      if (typeof parsed.confidence !== 'number' || 
          parsed.confidence < 0 || parsed.confidence > 1) {
        return { valid: false, error: 'Confidence must be number between 0-1' };
      }

      return { valid: true, data: parsed };
    } catch (error) {
      return { valid: false, error: `JSON parsing error: ${error.message}` };
    }
  }
}
