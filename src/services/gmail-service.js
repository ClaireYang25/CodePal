/**
 * Gmail API 服务
 * 处理 Gmail API 认证和邮件获取
 */

export class GmailService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://gmail.googleapis.com/gmail/v1';
  }

  /**
   * 获取最新邮件列表
   * @param {number} limit - 邮件数量限制
   * @returns {Promise<Array>} 邮件列表
   */
  async getLatestEmails(limit = 10) {
    try {
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

      for (const message of listData.messages || []) {
        try {
          const email = await this.getMessageDetails(message.id);
          emails.push(email);
        } catch (error) {
          console.warn(`Failed to get message ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      console.error('Failed to get latest emails:', error);
      throw error;
    }
  }

  /**
   * 获取邮件详情
   */
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

  /**
   * 解析邮件数据
   */
  parseEmailData(data) {
    const headers = data.payload.headers;
    const getHeader = (name) => 
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

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

  /**
   * 提取邮件正文
   */
  extractEmailBody(payload) {
    if (payload.body && payload.body.data) {
      return this.decodeBase64(payload.body.data);
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return this.decodeBase64(part.body.data);
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          return this.decodeBase64(part.body.data);
        }
      }
    }

    return '';
  }

  /**
   * Base64 解码
   */
  decodeBase64(data) {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  }
}

