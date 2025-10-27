/**
 * Gmail API Service
 * Handles Gmail API authentication and email fetching
 */

import { CONFIG } from '../config/constants.js';

export class GmailService {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  /**
   * Get latest emails
   * @param {number} limit - Number of emails to fetch
   * @returns {Promise<Array>} List of emails
   */
  async getLatestEmails(limit = CONFIG.API.GMAIL.DEFAULT_LIMIT) {
    try {
      const listResponse = await fetch(
        `${CONFIG.API.GMAIL.BASE_URL}/users/me/messages?maxResults=${limit}`,
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
   * Get message details
   */
  async getMessageDetails(messageId) {
    const response = await fetch(
      `${CONFIG.API.GMAIL.BASE_URL}/users/me/messages/${messageId}`,
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
   * Parse email data
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
   * Extract email body from payload
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
   * Decode Base64 email content
   */
  decodeBase64(data) {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  }
}
